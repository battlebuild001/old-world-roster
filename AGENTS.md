# Deployment targets

The application is used from two hosting origins:

- GitHub Pages: https://battlebuild001.github.io/old-world-roster/
- Existing installed apps: the original Sites project.

Read `/workspace/sites/old-world-roster/.openai/hosting.json` for the existing
Sites identity, then use `get_site` to resolve its current URL and audience.
Preserve that identity and audience. The user requested privacy: do not add the
original account domain or other creator identifiers to this public repository.

A GitHub Pages deployment does not update apps installed from the Sites origin.
Publish application fixes to both origins while those installations are supported,
and verify that their application files match before reporting completion.

Preserve the original manifest identity, scope, and localStorage keys. Existing
rosters belong to each origin's browser storage. Update the existing origin in
place; any future move needs a working data transfer flow before redirecting it.
Do not clear storage or ask the user to uninstall the app to apply an update.
Keep `update.html` available from the network so a legacy worker can load it.
This same-origin update entry waits for the complete current cache and preserves
rosters while opening the updated app; it must not force navigation of other tabs.
Sites redirects HTML files to canonical URLs. Verify the worker's complete-cache
status and active controller; a partially populated cache is not a successful
installation. Preserve tested canonical HTML redirect handling in the worker.

Check play navigation, roster confirmation, and existing roster preservation on
the actual deployment target. Distinguish browser history tests from real system
Back input, and do not claim physical Android testing without an actual device.
