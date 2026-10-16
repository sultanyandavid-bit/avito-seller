"""Reference schema verification in an ephemeral DB; never touches user data."""
import sqlite3
from pathlib import Path
conn=sqlite3.connect(':memory:')
conn.executescript(Path(__file__).parents[1].joinpath('schema/saas-reference.sql').read_text())
conn.execute("INSERT INTO users VALUES ('u','owner@example.test','2026-10-16')")
conn.execute("INSERT INTO workspaces VALUES ('w','u','Demo')")
conn.execute("INSERT INTO stores VALUES ('a','w','A','avito')")
conn.execute("INSERT INTO stores VALUES ('b','w','B','avito')")
conn.execute("INSERT INTO products VALUES ('p','w','a','Product','{}')")
try:
    conn.execute("INSERT INTO conversations VALUES ('c','w','b','p',NULL,NULL,1)")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError('Cross-store foreign key must be rejected')
conn.execute("INSERT INTO conversations VALUES ('c','w','a','p',NULL,NULL,1)")
assert not conn.execute('PRAGMA foreign_key_check').fetchall()
print('Reference schema valid; cross-store reference rejected; no user database modified.')
