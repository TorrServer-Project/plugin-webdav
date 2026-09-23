# TorrServer WebDAV

TorrServer plugin that exposes your torrent library over WebDAV, read-only.

## Features

- Read-only WebDAV access to your personal torrent library
- Works with macOS Finder, Windows Explorer, GNOME Files (Nautilus), Kodi, VLC, and any other WebDAV client
- Per-user password, stored hashed with PBKDF2
- Basic authentication over HTTP
- Range requests supported for video streaming
- Same folder layout as the server library, including categories and nested folders
- Torrents that are not yet fully indexed are hidden until metadata arrives

## Installation

### From the plugin store

Open the admin panel → Plugins → Store → Install.

### Manual install

1. Download the latest release ZIP from [Releases](https://github.com/TorrServer-Project/plugin-webdav/releases).
2. In the admin panel go to Plugins → Manual install, upload the ZIP.
3. Enable the plugin if it is disabled.

## Usage

Open the plugin page from the sidebar menu or at `/plugins/webdav/`.

1. Set a password for WebDAV access. Username is the same as your TorrServer account.
2. Copy the WebDAV URL shown on the page. It looks like:
   ```
   http://your-host:8090/plugins/webdav/dav/
   ```
3. In your WebDAV client, connect to that URL with your TorrServer username and the password you just set.

### Connecting from clients

**macOS Finder:** Go → Connect to Server → enter the URL → Connect → enter username and password.

**Windows Explorer:** Map Network Drive → enter the URL → enter username and password.

**GNOME Files (Nautilus):** `Ctrl+L` → enter `dav://your-host:8090/plugins/webdav/dav/` → enter username and password.

**Kodi:** Add source → WebDAV → enter URL, username, password.

**VLC:** Media → Open Network Stream → enter the URL, VLC will prompt for credentials.

## Notes

- The library is **read-only**. Files cannot be uploaded, deleted, or modified.
- Basic authentication sends credentials in plain base64. Only use WebDAV over the local network, or put TorrServer behind a reverse proxy with HTTPS if the server is reachable from the internet.
- Removing the password from the plugin page disables WebDAV access for your account.

## Compatibility

- TorrServer (Silo version) or later
- WebDAV level 1 (no locking)

## License

See [LICENSE](LICENSE).