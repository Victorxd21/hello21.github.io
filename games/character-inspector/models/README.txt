HOW TO ADD MODELS (super easy)
==============================

1. Drop any .glb file into this folder

2. Open models.json and add a new entry like this:

[
  {
    "name": "Haru Urara",
    "file": "haru.glb"
  },
  {
    "name": "My New Character",
    "file": "whatever-you-named-it.glb"
  }
]

That's it. Refresh the page and the new model will appear and start walking around.

TIPS
----
- Prefer models that already have walk/run animations inside the GLB
- If a model has no animation it will still walk (just slide)
- Name the file anything you want, just match it in models.json
