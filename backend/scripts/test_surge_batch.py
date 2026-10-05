import unittest
import pandas as pd
from surge_batch import excluded_name, surge_rows, Links


class BatchTests(unittest.TestCase):
    def test_daily_history_thresholds(self):
        frame = pd.DataFrame({"거래대금": [100000000000, 99999999999, 200000000000], "등락률": [10, 20, 9.9]}, index=["000001", "000002", "000003"])
        self.assertEqual(surge_rows(frame, "2026-10-05", 100000000000, 10), [{"ticker": "000001", "date": "2026-10-05", "value": "100000000000", "chgRate": 10.0}])

    def test_missing_data_fails_closed(self):
        with self.assertRaises(ValueError):
            surge_rows(pd.DataFrame({"종가": [100]}), "2026-10-05", 1, 1)

    def test_security_names(self):
        for name in ["미래스팩1호", "삼성전자우", "대신증권2우B", "ABC ETF", "ABC ETN"]:
            self.assertTrue(excluded_name(name))
        self.assertFalse(excluded_name("삼성전자"))

    def test_theme_html(self):
        parser = Links()
        parser.feed('<a href="/sise/sise_group_detail.naver?type=theme&amp;no=1"><b>조선</b></a>')
        self.assertEqual(parser.links, [("/sise/sise_group_detail.naver?type=theme&no=1", "조선")])


if __name__ == '__main__':
    unittest.main()
