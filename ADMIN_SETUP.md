# Admin Setup Guide

## Create Admin User

### Option 1: Using npm script (Recommended)

```bash
cd backend

# Create admin with default credentials
npm run create:admin

# Or with custom credentials
npm run create:admin admin@yourcompany.com yourpassword Admin User
```

**Default Admin Credentials:**
- Email: `admin@example.com`
- Password: `admin123`
- Name: `Admin User`
- Role: `SUPER_ADMIN`

### Option 2: Manual Creation

1. Register a regular user through the frontend
2. Then run the script to upgrade to admin:

```bash
cd backend
npm run create:admin your-email@example.com your-password
```

## Admin Login

### Access Admin Login Page

Navigate to: `http://localhost:3000/admin/login`

Or use the regular login page and click "Admin Login" link at the bottom.

### Admin Roles

The system supports these admin roles:

1. **SUPER_ADMIN**: Full system access
   - Can manage all workspaces
   - Can manage all projects
   - Can manage all users
   - Full access to all features

2. **WORKSPACE_OWNER**: Workspace-level admin
   - Can create projects in their workspace
   - Can manage workspace members
   - Can manage projects in their workspace

3. **PROJECT_MANAGER**: Project-level admin
   - Can manage specific projects
   - Can manage project members
   - Can create/edit boards and tasks

## Quick Start

```bash
# 1. Create admin user
cd backend
npm run create:admin

# 2. Start backend server
npm run dev

# 3. Start frontend server (in another terminal)
cd ../frontend
npm run dev

# 4. Login at http://localhost:3000/admin/login
# Use the credentials shown after running create:admin
```

## Security Notes

⚠️ **Important Security Practices:**

1. **Change Default Password**: Immediately change the default password after first login
2. **Use Strong Passwords**: Admin accounts should have strong, unique passwords
3. **Limit Admin Users**: Only create admin accounts for trusted users
4. **Regular Audits**: Periodically review admin user list
5. **Environment Variables**: Never commit admin credentials to version control

## Update Admin Password

To update an existing admin's password:

```bash
cd backend
npm run create:admin admin@example.com newpassword
```

This will update the password if the user already exists.

## Check Admin Status

You can verify a user is an admin by:

1. Logging in and checking the user role in the dashboard
2. Using Prisma Studio:

```bash
cd backend
npm run prisma:studio
```

Then navigate to the `users` collection and check the `role` field.

