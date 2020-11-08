const PREFIX = 'https://m.facebook.com/photo/view_full_size/?fbid=';

/**
 * Obtain the redirect URL for a given picture FBID.
 * @param fbid FBID of the picture to follow
 * @param headers headers to send in the request
 */
export async function fetchRedirect(fbid: string, headers: Headers): Promise<string | null> {
  const response = await fetchFacebook(PREFIX + fbid, headers);
  const body = await response.text();
  const url = /(?<=url=).*?(?=")/.exec(body);
  // For an invalid FBID, Facebook returns a page with a url=https://mbasic.facebook.com/home.php parameter somewhere
  if (url === null || url[0] === 'https://mbasic.facebook.com/home.php') {
    console.warn(`Cannot fetch URL for picture with FBID ${fbid}. Try accessing ${PREFIX}${fbid} in your browser and check if you can see the picture.`);
    return null;
  }
  return url[0].replace(/&amp;/g, '&');
}

/**
 * Make a request to Facebook, passing the necessary headers along.
 * @param url URL to retrieve
 * @param headers headers to send
 * @returns promise with the response to the request
 */
export async function fetchFacebook(url: string, headers: Headers): Promise<Response> {
  return await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers,
  });
}
