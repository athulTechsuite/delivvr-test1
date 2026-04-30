# delivvr-test1

## First-Admin Bootstrap

All new user registrations default to the `customer` role. To promote the first admin account, run the following SQL directly against the SQLite database:

```sh
sqlite3 database.sqlite "UPDATE users SET role='admin' WHERE email='admin@example.com';"
```

Replace `admin@example.com` with the email of the account you want to promote. The change takes effect on the user's **next login** (existing JWT sessions continue to carry the role that was active at login time).
