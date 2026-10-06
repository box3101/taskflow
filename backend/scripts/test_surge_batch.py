import unittest
import pandas as pd
from surge_batch import excluded_name, surge_rows, theme_maps


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

    def test_theme_api_pages_and_partial_failure(self):
        def fetch(url):
            if url.startswith("https://m.stock.naver.com/api/stocks/theme?"):
                page = int(url.split("page=")[1].split("&")[0])
                groups = [{"no": 1, "name": "조선"}, {"no": 2, "name": "원전"}] if page == 1 else []
                return {"groups": groups, "totalCount": 2}
            if "/theme/2?" in url:
                raise TimeoutError()
            return {"stocks": [{"itemCode": "009540"}, {"itemCode": "ABC"}], "totalCount": 2}
        maps, failed = theme_maps("2026-10-07", fetch, delay=0)
        self.assertEqual(failed, 1)
        self.assertEqual(maps, [{"ticker": "009540", "themeId": "NAVER:1", "themeName": "조선", "source": "NAVER", "validDate": "2026-10-07"}])

    def test_empty_theme_list_fails(self):
        with self.assertRaises(RuntimeError):
            theme_maps("2026-10-07", lambda url: {"groups": []}, delay=0)


if __name__ == '__main__':
    unittest.main()
