const {
  IAMClient,
  ListUsersCommand,
  GetLoginProfileCommand,
  ListMFADevicesCommand,
  GetUserCommand,
} = require("@aws-sdk/client-iam");

// Requires an IAM user/role with iam:ListUsers, iam:ListMFADevices,
// iam:GetLoginProfile permissions.
// Env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

async function fetchAccessReview({ warningsOnly = false } = {}) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) are not configured.");
  }

  const client = new IAMClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const { Users: rawUsers } = await client.send(new ListUsersCommand({ MaxItems: 100 }));

  const users = await Promise.all(
    rawUsers.map(async (u) => {
      // Check console access (LoginProfile exists = console enabled)
      let consoleAccess = false;
      try {
        await client.send(new GetLoginProfileCommand({ UserName: u.UserName }));
        consoleAccess = true;
      } catch {
        // NoSuchEntityException = no console access
      }

      // Check MFA devices
      const { MFADevices } = await client.send(
        new ListMFADevicesCommand({ UserName: u.UserName })
      );
      const hasMfa = MFADevices.length > 0;

      return {
        username: u.UserName,
        email: u.UserName, // IAM usernames are often emails; use as display
        arn: u.Arn,
        consoleAccess,
        mfa: hasMfa,
        passwordLastUsed: u.PasswordLastUsed?.toISOString() || null,
        created: u.CreateDate?.toISOString() || null,
      };
    })
  );

  // Warning = console access without MFA
  const warnings = users.filter((u) => u.consoleAccess && !u.mfa).length;
  const filtered = warningsOnly ? users.filter((u) => u.consoleAccess && !u.mfa) : users;

  return {
    control: "Access Review",
    system: "AWS IAM",
    source: "live",
    timestamp: new Date().toISOString(),
    lastFetched: new Date().toISOString(),
    status: warnings === 0 ? "Pass" : "Warning",
    totalUsers: users.length,
    warningsCount: warnings,
    users: filtered,
    summary: `${users.length} IAM users reviewed, ${warnings} warning${warnings !== 1 ? "s" : ""}`,
  };
}

module.exports = { fetchAccessReview };
