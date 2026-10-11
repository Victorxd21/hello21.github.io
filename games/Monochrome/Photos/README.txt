MONOCHROME - PHOTOS
===================
Put your pictures in this folder (JPG, PNG, WEBP or GIF, any size, any shape).
They hang in picture frames around the house. Each one is turned grayscale and gets the same
grain, scratches and dark edges as the paintings. Frames are sized to your picture, so you
don't need to know the ratio.

How the game finds them (it tries these in order):
  1. Your web server lists the folder (python -m http.server, VS Code "Live Server", `npx serve`, nginx autoindex...)
     -> any file names work.
  2. A list in Photos/photos.json, for servers that don't list folders:
        ["me.jpg", "holiday.png", "dog.webp"]
  3. Numbered names, nothing else needed:  1.jpg  2.jpg  3.png  ... up to 12.

IMPORTANT - opening index.html by double-click (file://):
  Browsers refuse to let a web page read pixels from local files, so the Photos folder can't be used that way.
  Either start a tiny local server in the monochrome folder (for example:  python -m http.server 8000
  then open http://localhost:8000 ), or use  Settings > Photos > LOAD PHOTOS...  and pick the images with the
  file picker. Picked photos are remembered in your browser.
