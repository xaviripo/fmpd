# Facebook Massive Picture Downloader

Download any number of Facebook pictures given a list of their FBIDs.


## ℹ️ About

Facebook has a tool that allows you to download all the pictures you have uploaded.
However, it does not allow to automatically download other sets of pictures, like, for instance, all the pictures that you've been tagged in.
In fact, this can be a hard task.
This script tries to make it easier.
Nevertheless, it works for any set of pictures uploaded to Facebook that you have access to.


## 🔢 Quick start

1. 🖼️ **Get the FBIDs of the pictures to download**

    Facebook assigns a unique identification number ("FBID") to every picture uploaded.
    You first need to obtain a list of the FBIDs of the pictures you want to download.

    In case you want to download all the pictures you've been tagged in, you can follow [these](https://github.com/gnmerritt/gnmerritt.net/issues/1#issuecomment-407623247) steps.

    Create a `fbids.txt` file with all the FBIDs, one per line.


2. 🍪 **Get your browser cookies**

    Facebook, naturally, only allows access to the pictures if you're logged in.
    Luckily, this can be emulated by sending a `Cookie` header in the request, usually contained in a `cookies.txt` file.
    This file is supposed to contain all the cookies from facebook.com that your browser has saved.
    To obtain it, you can use a browser extension.
    I used [this one](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/) for Firefox.

    First, make sure you log into Facebook with the keep me logged in option checked.
    Then, export the cookies in a `cookies.txt` file.


3. ⬇️ **Execute the script**

    You need to install [Deno](https://deno.land/) in order to run the program.
    There is no need to clone this repository, Deno can run scripts from arbitrary URLs.

    In the folder where the `cookies.txt` and `fbids.txt` files are placed, run from a terminal:

    ```sh
    deno run --unstable --allow-net --allow-read --allow-write https://raw.githubusercontent.com/xaviripo/fmpd/master/mod.ts - < fbids.txt
    ```

    Each picture will be saved with its FBID followed by ".jpg" as its name in the folder.


## ❔ Documentation

Coming soon
