"""Tests for the sheet-to-heard word matching in lyrics_align.py. Run: npm run test:lyrics"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I leaves the script's folder off sys.path
from lyrics_align import match_opcodes  # noqa: E402


def pairs(a: list[str], b: list[str]) -> dict[int, int]:
    """Sheet word index -> heard word index, for the words match_opcodes says are equal."""
    out: dict[int, int] = {}
    for tag, i1, i2, j1, _ in match_opcodes(a, b):
        if tag == "equal":
            out.update({i1 + k: j1 + k for k in range(i2 - i1)})
    return out


CHORUS = "time for another plunge into the unknown where i wind up".split()
VERSE = "a respite of sorts back where i started".split()


class MatchOpcodes(unittest.TestCase):
    def test_second_chorus_of_the_sheet_pairs_with_the_second_sung_chorus(self):
        # The first sung chorus and the verse were misheard, the second chorus heard perfectly, so it is the longest
        # clean run (Ride the Biggest Waves, 2026-11-06). Both choruses of the sheet must still pair in order, not the
        # first sheet chorus with the second sung one.
        a = CHORUS + VERSE + CHORUS
        garbled = "another punch into the unknown where i whine".split()
        misheard_verse = "a little bit back there stunted".split()
        b = garbled + misheard_verse + CHORUS
        got = pairs(a, b)
        second_sheet = len(CHORUS) + len(VERSE)
        second_sung = len(garbled) + len(misheard_verse)
        self.assertEqual(got[second_sheet], second_sung)  # the second "time" of the sheet is the second sung "time"
        self.assertEqual(got[len(CHORUS) + VERSE.index("back")], len(garbled) + misheard_verse.index("back"))  # the verse stays with the verse

    def test_pairs_stay_in_order(self):
        a = CHORUS + VERSE + CHORUS
        b = "stand once again".split() + CHORUS + "oh oh oh".split() + VERSE + "no no".split() + CHORUS
        got = sorted(pairs(a, b).items())
        self.assertEqual([j for _, j in got], sorted(j for _, j in got))

    def test_ranges_cover_both_lists_with_no_gaps(self):
        a = "i stand once again on the shore".split()
        b = "stand once more again on a shore today".split()
        ops = match_opcodes(a, b)
        self.assertEqual((ops[0][1], ops[0][3]), (0, 0))
        self.assertEqual((ops[-1][2], ops[-1][4]), (len(a), len(b)))
        for x, y in zip(ops, ops[1:]):
            self.assertEqual((x[2], x[4]), (y[1], y[3]))

    def test_tags_say_what_differs(self):
        tags = lambda a, b: [o[0] for o in match_opcodes(a.split(), b.split())]  # noqa: E731
        self.assertEqual(tags("a b c", "a b c"), ["equal"])
        self.assertEqual(tags("a b c", "a c"), ["equal", "delete", "equal"])
        self.assertEqual(tags("a c", "a b c"), ["equal", "insert", "equal"])
        self.assertEqual(tags("a b c", "a x c"), ["equal", "replace", "equal"])

    def test_nothing_heard_or_nothing_on_the_sheet(self):
        self.assertEqual(match_opcodes(["a", "b"], []), [("delete", 0, 2, 0, 0)])
        self.assertEqual(match_opcodes([], ["a"]), [("insert", 0, 0, 0, 1)])
        self.assertEqual(match_opcodes([], []), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
