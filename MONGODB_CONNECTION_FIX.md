# MongoDB Connection Troubleshooting

## Error: "Server selection timeout: No available servers" / "fatal alert: InternalError"

This error indicates that your application cannot connect to MongoDB Atlas. Here are the steps to fix it:

## Step 1: Check MongoDB Atlas IP Whitelist

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Navigate to **Network Access** (or **IP Access List**)
3. Click **Add IP Address**
4. Add your current IP address, or use `0.0.0.0/0` for development (⚠️ **NOT recommended for production**)
5. Wait a few minutes for changes to propagate

## Step 2: Verify Connection String

Your connection string should look like:
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

Make sure:
- ✅ Username and password are correct
- ✅ No special characters need URL encoding (e.g., `@` should be `%40` if in password)
- ✅ Database name is specified
- ✅ Connection string includes `retryWrites=true&w=majority`

## Step 3: Check MongoDB Atlas Cluster Status

1. Go to **Clusters** in MongoDB Atlas
2. Ensure your cluster is **running** (not paused)
3. If paused, click **Resume** and wait for it to start

## Step 4: Verify Network Connectivity

Test if you can reach MongoDB Atlas:
```bash
# Test connection (replace with your cluster URL)
ping pms.3bpjipm.mongodb.net
```

## Step 5: Update Connection String (if needed)

If you're still having issues, try adding these parameters to your connection string:

```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority&ssl=true&tlsAllowInvalidCertificates=false
```

## Step 6: Check Firewall/VPN

- If you're behind a corporate firewall, it might be blocking MongoDB connections
- Try disconnecting from VPN temporarily
- Check if your ISP is blocking the connection

## Step 7: Regenerate Connection String

1. In MongoDB Atlas, go to **Database Access**
2. Click **Edit** on your database user
3. Click **Edit Password** (optional)
4. Go to **Clusters** → **Connect** → **Connect your application**
5. Copy the new connection string
6. Update your `.env` file with the new `DATABASE_URL`

## Step 8: Test Connection

After making changes, test the connection:

```bash
cd backend
npm run prisma:db:push
```

## Common Issues:

### Issue: "Authentication failed"
- **Solution**: Check username/password in connection string

### Issue: "IP not whitelisted"
- **Solution**: Add your IP to Network Access list in MongoDB Atlas

### Issue: "Cluster is paused"
- **Solution**: Resume the cluster in MongoDB Atlas dashboard

### Issue: "SSL/TLS handshake failed"
- **Solution**: 
  - Check if your connection string uses `mongodb+srv://` (not `mongodb://`)
  - Verify network connectivity
  - Try adding `ssl=true` to connection string

## Quick Fix: Allow All IPs (Development Only)

⚠️ **WARNING**: Only for development/testing!

1. Go to MongoDB Atlas → **Network Access**
2. Click **Add IP Address**
3. Enter `0.0.0.0/0` (allows all IPs)
4. Add comment: "Development - Remove in production"
5. Click **Confirm**

## Still Having Issues?

1. Check MongoDB Atlas status page: https://status.mongodb.com/
2. Review MongoDB Atlas logs in the dashboard
3. Try creating a new database user with fresh credentials
4. Contact MongoDB Atlas support if the issue persists

