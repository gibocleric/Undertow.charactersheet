# Undertow Character Builder

## Put the app on GitHub Pages

Upload `index.html`, `community-trees.json`, `site-config.json`, the `assets` folder, and the `fonts` folder to the publishing root of your GitHub repository. GitHub Pages serves the app and shared tree/settings data to everyone.

## Apply shared changes to the actual GitHub Pages site

The local admin editor needs Node.js and Git for Windows, with your GitHub sign-in available to Git. It publishes through GitHub. A **clone** is the local checkout connected to your GitHub repository; it is the working copy, while `git push` sends the commit to GitHub. GitHub Pages then serves the files from the branch and folder configured in your repository's **Settings → Pages**.

The first time you start the editor, choose the exact folder GitHub Pages serves. That folder must contain the live `index.html` and be inside your GitHub checkout. Choose the repository root when Pages publishes from `/ (root)`, or choose `docs` when Pages publishes from `/docs`. The selection is remembered on this computer. If the wrong folder was selected, stop the editor and remove `.admin-publish-dir` beside `admin-server.js`; the next launch asks again.

For the site to load shared changes, upload the package's current `index.html`, `community-trees.json`, and `site-config.json` into that same Pages folder. Keep the `assets` and `fonts` folders there too. If the project uses a `.gitignore`, add these private local entries and do not upload the admin account file:

```
.admin-access.json
.admin-publish-dir
*.tmp
```

Double-click `start-admin.bat`. It creates an **Undertow Admin** shortcut, asks you to choose the Pages folder, starts the local editor, and opens the app. The first run also asks you to create a local admin account. The account and selected folder are stored locally and ignored by Git. The server only accepts connections from this computer. In the app, press **Ctrl+Alt+Shift+U** from any phase to open the hidden admin sign-in.

When updating an existing install, stop its server with **Ctrl+C**, extract the latest package, and double-click `update-admin.bat`. Choose the folder containing your current `admin-server.js`. The updater replaces the app and server files there while keeping `.admin-access.json`, `.admin-publish-dir`, `community-trees.json`, and an existing `site-config.json`, then starts the updated service.

Add, edit, or remove trees and perks. Every change asks for confirmation; **Undo last change** reverses the latest draft edit. Leaving the page with unpublished edits also triggers a browser confirmation.

Open admin sign-in with **Ctrl+Alt+Shift+U**. Use **Perks** to edit trees and perks and **Inventory** to add items and attach them to perks. Choose **Apply universal changes** to publish the tree catalog and settings together in one commit. The editor stages `community-trees.json` and `site-config.json`, pushes that commit to the selected checkout's `origin` branch, then checks GitHub's reported branch commit before it says publishing succeeded. A local save alone is never reported as a universal publish. After GitHub Pages deploys that branch and folder, other devices load both JSON files beside the page. The success message names the branch and commit. If GitHub rejects the push, the editor explains the failure and does not claim the changes are public.

In GitHub, confirm **Settings → Pages** publishes the same branch and folder you selected. A verified GitHub push means the repository has the files; the site becomes current when its Pages deployment completes. Check the repository's **Actions** tab if the website has not refreshed after the deployment. Never upload `.admin-access.json` or put an admin password or GitHub token in the website files.

## Character saves

Characters are stored in the current browser on the current device. Open **Saved Characters** and choose **Export file** to make a portable `.undertow.json` backup. Use **Import character file** on another device to load it. Export and import are manual; character changes do not sync automatically.
