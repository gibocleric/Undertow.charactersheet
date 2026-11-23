# Undertow Character Builder

## Put the app on GitHub Pages

Upload `index.html`, `community-trees.json`, `site-config.json`, the `assets` folder, and the `fonts` folder to the publishing root of your GitHub repository. GitHub Pages serves the app and shared tree/settings data to everyone.

## Add or update shared skill trees

The local editor needs Node.js and a local clone of the same GitHub repository. Copy `admin-server.js`, `start-admin.bat`, `update-admin.bat`, `update-admin.ps1`, `.gitignore`, `community-trees.json`, `site-config.json`, `index.html`, `assets`, and `fonts` into that clone's publishing root. Do not replace `.gitignore` if your repository already has one; add these two entries to it instead:

```
.admin-access.json
*.tmp
```

Double-click `start-admin.bat`. It creates an **Undertow Admin** shortcut on your desktop, starts the local editor, and opens the app. The first run asks you to create an admin account name and password. Those credentials are kept on that computer in the ignored `.admin-access.json` file. The server listens only on that computer. In the local app, press **Ctrl+Alt+Shift+U** from any phase to open the hidden admin sign-in. After signing in, the admin-only **Go to next phase** button lets you move through the character flow without completing each form. After setup, start the editor from the desktop shortcut instead of browsing to the package folder.

When updating an existing install, stop its server with **Ctrl+C**, extract the latest package, and double-click `update-admin.bat`. Choose the folder containing your current `admin-server.js`. The updater replaces the app and server files there while keeping `.admin-access.json`, `community-trees.json`, and an existing `site-config.json`, then starts the updated service. If you choose the package folder itself, it skips copying and starts the service from that folder. Its launcher also refreshes the desktop shortcut.

Add, edit, or remove trees and perks. Every change asks for confirmation; **Undo last change** reverses the latest draft edit. Leaving the page with unpublished edits also triggers a browser confirmation.

After signing in, use the **Perks** page to add or edit perk trees and perks, including built-in perk names, descriptions, costs, and prerequisites. Use the **Inventory** page to add shared items and attach them to perks. **Apply universal changes** publishes the tree catalog and site settings to the repository. Both `community-trees.json` and `site-config.json` are the persistent shared data: keep those files when updating the app HTML, and do not replace them with the blank defaults from a later package. The updater preserves both data files. To update GitHub Pages manually, upload the new `index.html` and any changed assets while leaving those two JSON files in place. Changes reach everyone after the local admin service successfully pushes them to GitHub.

If the Git push fails, the catalog is still saved locally and the editor displays the reason. Set up Git authentication and a push-capable repository clone, then publish again. Never upload `.admin-access.json` or put an admin password or GitHub token in the website files.

## Character saves

Characters are stored in the current browser on the current device. Open **Saved Characters** and choose **Export file** to make a portable `.undertow.json` backup. Use **Import character file** on another device to load it. Export and import are manual; character changes do not sync automatically.
