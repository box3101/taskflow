import tempfile
import unittest
from datetime import datetime
from spike_leader import KST, LeaderRecorder, rank_signal, read_records

class LeaderTest(unittest.TestCase):
    def setUp(self):
        self.at=datetime(2026,9,30,9,5,tzinfo=KST).timestamp()
        self.pool={'a':['A','theme',['theme']], 'b':['B','theme',['theme']]}
        self.q={c:dict(turnoverWon=v,turnoverSampleTs=self.at-1,turnoverSourceTs=self.at-2,dayPct=v) for c,v in [('a',200),('b',100)]}
    def test_rank(self):
        self.assertEqual(rank_signal(self.pool,self.q,'a','theme',self.at)['status'],'pass')
        self.assertEqual(rank_signal(self.pool,self.q,'b','theme',self.at)['rank'],2)
    def test_missing_stale_future(self):
        for stamp in (self.at-91,self.at+4,None):
            self.q['b']['turnoverSourceTs']=stamp
            self.assertEqual(rank_signal(self.pool,self.q,'a','theme',self.at)['status'],'unknown')
    def test_snapshot_and_immutable_signal(self):
        with tempfile.TemporaryDirectory() as d:
            r=LeaderRecorder(d,self.pool,self.at)
            r.capture(self.q,self.at,'a','theme','09:05:00')
            self.q['a']['turnoverWon']=1
            r.capture(self.q,self.at+1,'a','theme','09:05:00')
            data=read_records(d)
            self.assertEqual(data['records']['2026-09-3009:05a']['turnoverWon'],200)
            r.db.close()
    def test_ties_and_frozen_universe(self):
        self.q['b']['turnoverWon']=200
        self.assertTrue(rank_signal(self.pool,self.q,'b','theme',self.at)['tied'])
        with tempfile.TemporaryDirectory() as d:
            r=LeaderRecorder(d,self.pool,self.at);r.db.close()
            r=LeaderRecorder(d,{'a':self.pool['a']},self.at)
            self.assertEqual(len(r.pool),2);r.db.close()

if __name__=='__main__': unittest.main()
