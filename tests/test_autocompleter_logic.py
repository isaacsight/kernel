import unittest
import re

class AutoCompleterLogic:
    def __init__(self):
        pass

    def get_matches(self, text, cursor_index):
        """
        Scan text for words and return matches for the word at cursor_index.
        Returns (current_word_prefix, list_of_matches)
        """
        # 1. Identify the word being typed (the prefix)
        # We look backwards from cursor_index until we hit a non-word char
        prefix = ""
        for i in range(cursor_index - 1, -1, -1):
            char = text[i]
            if re.match(r'\w', char):
                prefix = char + prefix
            else:
                break
        
        if not prefix or len(prefix) < 2:
            return prefix, []

        # 2. Extract all words from the text
        # Simple regex to find words of 2+ chars
        all_words = set(re.findall(r'\b\w{2,}\b', text))
        
        # 3. Filter for matches starting with prefix (case insensitive?)
        # Let's do case sensitive for code, maybe? Or smart case?
        # Let's stick to consistent case for now.
        matches = [w for w in all_words if w.startswith(prefix) and w != prefix]
        
        return prefix, sorted(matches)

class TestAutoCompleterLogic(unittest.TestCase):
    def setUp(self):
        self.completer = AutoCompleterLogic()

    def test_basic_completion(self):
        text = "def hello_world():\n    hello_there = 1\n    hel"
        cursor_index = len(text)
        prefix, matches = self.completer.get_matches(text, cursor_index)
        
        self.assertEqual(prefix, "hel")
        self.assertIn("hello_world", matches)
        self.assertIn("hello_there", matches)

    def test_short_prefix(self):
        text = "def a"
        cursor_index = len(text)
        prefix, matches = self.completer.get_matches(text, cursor_index)
        self.assertEqual(prefix, "a")
        self.assertEqual(matches, []) # Should ignore < 2 chars

    def test_middle_of_text(self):
        text = "import random\nimport re"
        # cursor at end of "re"
        cursor_index = len(text) 
        prefix, matches = self.completer.get_matches(text, cursor_index)
        self.assertEqual(prefix, "re")
        # "random" starts with "r", but prefix is "re". "return" not in text.
        # "import" is in text. 
        # "re" is the prefix, so it shouldn't match itself unless it's a separate word elsewhere?
        # logic says w != prefix
        self.assertEqual(matches, [])

    def test_existing_words(self):
        text = "class CodeLens:\n    pass\n\nCode"
        cursor_index = len(text)
        prefix, matches = self.completer.get_matches(text, cursor_index)
        self.assertEqual(prefix, "Code")
        self.assertIn("CodeLens", matches)

if __name__ == '__main__':
    unittest.main()
