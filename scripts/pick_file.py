"""Fill a browser's native "Open" file dialog with a path and press Open (Windows only).

Used by `npm run pick-file` (scripts/pick-file.ts) for the YouTube upload: Claude clicks "Select files" in Studio
through Claude in Chrome, which opens Windows' Open dialog; this finds that dialog (owned by a browser process),
types the full path into the File name box and invokes the Open button, so the browser reads the file straight
from disk. It drives the dialog through UI Automation, not the mouse: nothing moves on screen and it doesn't
matter where the dialog is.

With --save it fills the browser's Save dialog instead, for a page's download when the browser asks where to save (the
grok-imagine skill), and waits for the file to arrive at that path.

Usage: python pick_file.py <absolute path> [--timeout 20] [--tab "<title start>" [--stay]] [--save]
--tab brings that browser tab to the front first (browsers only open a file chooser for the visible tab) and switches
back to the tab that was in front once the file is picked, unless --stay.
Exit codes: 0 picked or saved, 2 no dialog found before the timeout, 3 the dialog didn't accept the file.
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


OPEN_BOX, SAVE_BOX = "1148", "1001"  # automation ids of the File name box in Windows' Open and Save dialogs


def find_dialogs(box: str = OPEN_BOX):
    """File dialogs (class #32770 with this File name box) owned by a browser. UI Automation lists them as
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
            if control(w, "Edit", box):
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
    ap.add_argument("--save", action="store_true", help="fill the browser's Save dialog instead: the path is where the file goes")
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
        return save(path, args.timeout) if args.save else pick(path, args.timeout)
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
    time.sleep(1)  # the dialog lists its File name box before it is ready to take input
    edit = control(dlg, "Edit", "1148")
    edit.set_edit_text(path)
    # The classic dialog's Open is Button "1"; Brave's (2026-11) is a split button with no such id, so press Enter in
    # the File name box instead, which opens the file in both.
    button = control(dlg, "Button", "1")
    if button is not None:
        button.invoke()
    else:
        edit.type_keys("{ENTER}", set_foreground=True)

    # The dialog closes once the browser has the file; if it stays (an error box, a bad path), say so.
    end = time.time() + 5
    while time.time() < end:
        if not find_dialogs():
            print(f'picked {path} in "{title}" ({browser})')
            return 0
        time.sleep(0.2)
    print(f'the "{title}" dialog is still open after pressing Open; check it on screen', file=sys.stderr)
    return 3


def save(path: str, timeout: float) -> int:
    """Fill the browser's Save dialog (a page's download, when the browser asks where to save) and wait for the file."""
    deadline = time.time() + timeout
    dialogs = []
    while time.time() < deadline:
        dialogs = find_dialogs(SAVE_BOX)
        if dialogs:
            break
        time.sleep(0.3)
    if not dialogs:
        print(f"no browser Save dialog appeared within {timeout:g} s", file=sys.stderr)
        return 2
    if len(dialogs) > 1:
        print(f"{len(dialogs)} browser Save dialogs are open; close the extras and retry", file=sys.stderr)
        return 3

    dlg = dialogs[0]
    title = dlg.window_text()
    time.sleep(1)  # as with Open: the box is listed before it is ready to take input
    control(dlg, "Edit", SAVE_BOX).set_edit_text(path)
    control(dlg, "Button", "1").invoke()

    # The browser writes a temporary file while the dialog is up, and moves it into place once it closes.
    end = time.time() + 30
    while time.time() < end:
        if not find_dialogs(SAVE_BOX) and os.path.isfile(path) and os.path.getsize(path) > 0:
            print(f'saved {path} from "{title}"')
            return 0
        time.sleep(0.3)
    print(f'{path} did not appear after pressing Save in "{title}"; check it on screen', file=sys.stderr)
    return 3


if __name__ == "__main__":
    sys.exit(main())
