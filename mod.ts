#!/usr/bin/env -S deno run --unstable --allow-net --allow-read --allow-write

import { readLines } from 'https://deno.land/std@0.76.0/io/bufio.ts';
import { format } from 'https://deno.land/std@0.76.0/datetime/mod.ts';
import { parse } from 'https://deno.land/std@0.76.0/flags/mod.ts';
import { exists, ensureDir } from "https://deno.land/std@0.76.0/fs/mod.ts";
import { resolve } from 'https://deno.land/std@0.76.0/path/mod.ts';

import { fetchRedirect, fetchFacebook } from './fetch.ts';

const DEFAULT_AGENT = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0';
const DEFAULT_COOKIES_FILE = 'cookies.txt';
const DEFAULT_NAME = 'f.jpg';
const DEFAULT_QUIET = true;
const DEFAULT_STDIN = false;

/**
 * main function for the CLI
 */
async function main(): Promise<void> {

  // Parse arguments
  const args = parse(Deno.args, {
    string: ['_'], // Always treat positional arguments as strings
    boolean: ['quiet', 'q', 'help', 'h'],
  });

  if (args['help'] || args['h']) {
    console.log(`Facebook Massive Picture Downloader
    Downloads any number of Facebook pictures given a list of their FBIDs.

  INSTALL:
    deno install --unstable --allow-net --allow-read --allow-write -n fmpd https://raw.githubusercontent.com/xaviripo/fmpd/master/mod.ts

  USAGE:
    fmpd [options] [fbid ...] [-]

  OPTIONS:

    -h, --help                      Prints help information
    -a, --agent <AGENT>             Provide User-Agent string
    -c, --cookies-file <COOKIES>    Provide a file with the cookies for the requests
    -n, --name <NAME>               Provide a format string for the names of the downloaded files. Can include / to make folders
    -q, --quiet                     Omit printing the names of the downloaded files`);
    Deno.exit();
  }

  // Generate options for fetch() calls to Facebook
  const agent = args['agent'] ?? args['a'] ?? DEFAULT_AGENT;
  const cookiesFilename = resolve(args['cookies-file'] ?? args['c'] ?? DEFAULT_COOKIES_FILE);
  const cookies = await readCookies(cookiesFilename);
  const headers = new Headers({
    'User-Agent': agent,
    'Cookie': cookies,
  });

  // Format string for the file name
  const name = args['name'] ?? args['n'] ?? DEFAULT_NAME;

  // Don't log to console the names of the created files
  const quiet = (args['quiet'] || args['q']) ?? DEFAULT_QUIET;

  // Read FBIDs also from STDIN?
  let stdin = DEFAULT_STDIN;
  if (args._.includes('-')) {
    stdin = true;
    args._ = args._.filter(x => x !== '-');
  }

  // Do the thing
  await download(
    stdin ? chain(args._ as string[], readLines(Deno.stdin)) : asyncIter(args._ as string[]),
    headers,
    name,
    quiet
  );

}

async function* asyncIter<T>(iter: Iterable<T>) {
  yield* iter;
}

async function* chain<T>(head: Iterable<T>, tail: AsyncIterable<T>) {
  yield* head;
  yield* tail;
}

/**
 * Download pictures from Facebook given a list of their FBIDs and some metadata.
 * @param {AsyncIterable<string>} fbids Async iterable with the FBIDs of the pictures to download
 * @param {Headers} headers Headers to make the requests with, including user agent and cookies
 * @param {string} name Format string used to name the files as they are downloaded. See @see {@link parseFormatString} for info
 * @param {boolean} quiet Whether to omit the name of each downloaded file in console
 * @returns {Promise<void>} a promise to be resolved once all downloads have finished or stopped
 */
export default async function download(
  fbids: AsyncIterable<string>,
  headers: Headers = new Headers({
    'User-Agent': DEFAULT_AGENT,
  }),
  name: string = DEFAULT_NAME,
  quiet: boolean = DEFAULT_QUIET,
): Promise<void> {

  // Generate the formatter for the downloaded files names
  const formatter = parseFormatString(name);

  // Each line fed to the program through stdin is a FBID
  for await (const fbid of fbids) {

    const trim = fbid.trim();
    // Ignore blank lines and comments
    if (trim === '' || trim.startsWith('#')) {
      continue;
    }
    const url = await fetchRedirect(trim, headers);
    if (url === null) {
      continue;
    }
    const response = await fetchFacebook(url, headers);
    const dateString = response.headers.get('last-modified');

    let date;
    if (dateString === null) {
      if (!quiet) {
        console.warn(`Invalid date received from Facebook for picture with FBID ${fbid}. Using current date for its name.`);
      }
      date = new Date();
    } else {
      date = new Date(dateString);
    }

    // We use 1-indexing because:
    // a) It's what most people are used to
    // b) If you want 0-indexing, start 1-indexing from the first REPEATED picture and then rename the first one
    // Unfortunately, this means that there is no way to 0-index from the first REPEATED picture, but that's nitpicky.
    let index = 1;
    let originalName = formatter(fbid, date, index);
    let name = originalName;
    while (await exists(name)) {
      index++;
      name = formatter(fbid, date, index);
      // The name format string contains no indices, just rewrite the file!
      if (name === originalName) break;
    }

    const parts = name.split('/');
    await ensureDir(parts.slice(0, -1).join('/'));
    await Deno.writeFile(name, new Uint8Array(await response.arrayBuffer()));

    if (!quiet) {
      console.log(`${name}`);
    }
  }

}

/**
 * Takes a format string and returns a formatter function. This function then takes the data to format the string with
 * and returns the formatted string.
 * 
 * The format string supports the symbols specified by {@link format} (see {@link https://deno.land/std@0.76.0/datetime/README.md}), plus the following symbols:
 * - `f` - the FBID of the picture.
 * - `i...i` - an increasing index count for files with repeated names, starting at the first repeated picture.
 * The number of `i`s indicates the minimum number of figures to use.
 * - `I...I` - an increasing index count for files with repeated names, starting at the first picture, even if not repeated yet.
 * The number of `I`s indicates the minimum number of figures to use.
 * @example "yyyyMMddiii.jpg" // "20160519.jpg", "20160519001.jpg", "20160519002.jpg", "20191220", ...
 * @example "yyyyMMddIII.jpg" // "20160519001.jpg", "20160519002.jpg", "20160519003.jpg", "20191220001", ...
 * @see {@link https://deno.land/std@0.76.0/datetime/README.md} for information about the allowed symbols
 * @param formatString format string to use as base
 * @returns a function taking a FBID, a Date object, and an index number, and returns the string formatted with these data
 */
function parseFormatString(formatString: string): (fbid: string, date: Date, index: number) => string {
  const parts = formatString.split('\'');
  return (fbid: string, date: Date, index: number) => format(date, parts.reduce((acc, cur, idx) => {
    let parsedCur = cur;
    // Process the parts outside of 'quotes' (e.g. "yes'no'yes")
    // The last part is always processed, there are no "open" literals (e.g. "yes'no'yes'yes")
    if ((idx % 2 === 0) || (idx === parts.length - 1)) {
      // f -> fbid of the picture
      parsedCur = parsedCur.replace(/f/g, fbid);
      // i+ -> incremental index (for files with the same name), starting at the first repeat
      parsedCur = parsedCur.replace(/i+/g, match => index === 1 ? '' : index.toString().padStart(match.length, '0'));
      // I+ -> incremental index (for files with the same name), starting at the first picture
      parsedCur = parsedCur.replace(/I+/g, match => index.toString().padStart(match.length, '0'));
    }
    return acc + '\'' + parsedCur;
  }, '').slice(1));
}

/**
 * Read the given cookies file and extract the cookies as a single string
 * @see {@link https://curl.haxx.se/docs/http-cookies.html} for information about the curl cookies file format
 * @param filename name of the text file containing the cookies in curl cookies file format (see {@link https://curl.haxx.se/docs/http-cookies.html})
 * @returns a promise with the cookies string in the Cookie header format
 */
async function readCookies(filename: string): Promise<string> {
  const fileReader = await Deno.open(filename);
  const cookies = [];
  for await (const line of readLines(fileReader)) {
    // Ignore comments.
    // Although technically all lines starting with # are comments, in practice some necessary cookies begin with #
    if (line.trim() === '' || line.startsWith('# ')) {
      continue;
    }
    const pieces = line.split('\t');

    // Each cookie is a key=value pair made up of the last two fields
    // We don't use a dictionary as it's legal to send multiple cookies with the same key
    cookies.push(`${pieces[pieces.length - 2]}=${pieces[pieces.length - 1]}`);
  }
  return cookies.join('; ');
}

if (import.meta.main) {
  await main();
}
