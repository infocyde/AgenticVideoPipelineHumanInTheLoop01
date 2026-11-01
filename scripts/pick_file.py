"""Fill a browser's native "Open" file dialog with a path and press Open (Windows only).

Used by `npm run pick-file` (scripts/pick-file.ts) for the YouTube upload: Claude clicks "Select files" in Studio
through Claude in Chrome, which opens Windows' Open dialog; this finds that dialog (owned by a browser process),
types the full path into the File name box and invokes the Open button, so the browser reads the file straight
from disk. It drives the dialog through UI Automation, not the mouse: nothing moves on screen and it doesn't
matter where the dialog is.

Usage: python pick_file.py <absolute path> [--timeout 20] [--tab "<title start>" [--stay]]
--tab brings that browser tab to the front first (browsers only open a file chooser for the visible tab) and switches
back to the tab that was in front once the file is picked, unless --stay.
Exit codes: 0 picked, 2 no dialog found before the timeout, 3 the dialog didn't accept the file.
"""

import argparse
import ctypes
import os
import sys
import time

from pywinauto import Desktop

BROWSERS = {"chrome.exe", "msedge.exe", "brave.exe"}


def process_name(pid: int) -> str:
    """Executable name of a process, e.g. chrome.exe ("" if it can't be read)."""
    k32 = ctypes.windll.kernel32
    handle = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        return ""
    try:
        buf = ctypes.create_unicode_buffer(1024)
        size = ctypes.c_ulong(len(buf))
        if not k32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
            return ""
        return os.path.basename(buf.value).lower()
    finally:
        k32.CloseHandle(handle)


def control(w, control_type: str, auto_id: str):
    """First descendant of `w` with this control type and automation id, or None."""
    for e in w.descendants(control_type=control_type):
        if e.element_info.automation_id == auto_id:
            return e
    return None


def find_dialogs():
    """Open-file dialogs (class #32770 with a File name box) owned by a browser. UI Automation lists them as
    top-level windows or as children of the browser window (Brave's "<site> wants to open"), so look in both."""
    desktop = Desktop(backend="uia")
    candidates = []
    for w in desktop.windows():
        try:
            if process_name(w.process_id()) not in BROWSERS:
                continue
            if w.class_name() == "#32770":
                candidates.append(w)
            elif w.class_name() == "Chrome_WidgetWin_1":
                candidates += [c for c in w.children() if c.class_name() == "#32770"]
        except Exception:
            continue
    found = []
    for w in candidates:
        try:
            if control(w, "Edit", "1148"):
                found.append(w)
        except Exception:
            continue
    return found


def select_tab(prefix: str):
    """Bring the browser tab whose title starts with `prefix` to the front of its window (a browser only opens a
    file chooser for the visible tab). Returns the tab that was in front before, or None if it already was."""
    for w in Desktop(backend="uia").windows(class_name="Chrome_WidgetWin_1"):
        try:
            if process_name(w.process_id()) not in BROWSERS:
                continue
            tabs = w.descendants(control_type="TabItem")
        except Exception:
            continue
        target = next((t for t in tabs if t.window_text().startswith(prefix)), None)
        if target is None:
            continue
        before = next((t for t in tabs if t.is_selected()), None)
        if before is not None and before.window_text() == target.window_text():
            return None
        target.select()
        return before
    raise LookupError(f'no browser tab whose title starts with "{prefix}"')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--timeout", type=float, default=20)
    ap.add_argument("--tab", help="bring the tab whose title starts with this to the front first")
    ap.add_argument("--stay", action="store_true", help="leave that tab in front afterwards")
    args = ap.parse_args()
    path = os.path.abspath(args.path)

    previous = None
    if args.tab:
        try:
            previous = select_tab(args.tab)
        except LookupError as e:
            print(e, file=sys.stderr)
            return 2
        print(f'"{args.tab}" tab is in front; click the page\'s file button now', flush=True)
    try:
        return pick(path, args.timeout)
    finally:
        if previous is not None and not args.stay:
            # Switching tabs the instant the dialog closes loses the file (tested in Brave): let the page take it first.
            time.sleep(2)
            try:
                previous.select()
            except Exception:
                pass


def pick(path: str, timeout: float) -> int:
    deadline = time.time() + timeout
    dialogs = []
    while time.time() < deadline:
        dialogs = find_dialogs()
        if dialogs:
            break
        time.sleep(0.3)
    if not dialogs:
        print(f"no browser Open dialog appeared within {timeout:g} s", file=sys.stderr)
        return 2
    if len(dialogs) > 1:
        print(f"{len(dialogs)} browser Open dialogs are open; close the extras and retry", file=sys.stderr)
        return 3

    dlg = dialogs[0]
    title = dlg.window_text()
    browser = process_name(dlg.process_id())
    edit = control(dlg, "Edit", "1148")
    edit.set_edit_text(path)
    control(dlg, "Button", "1").invoke()

    # The dialog closes once the browser has the file; if it stays (an error box, a bad path), say so.
    end = time.time() + 5
    while time.time() < end:
        if not find_dialogs():
            print(f'picked {path} in "{title}" ({browser})')
            return 0
        time.sleep(0.2)
    print(f'the "{title}" dialog is still open after pressing Open; check it on screen', file=sys.stderr)
    return 3


if __name__ == "__main__":
    sys.exit(main())
