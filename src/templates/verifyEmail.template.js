export const verifyEmailTemplate = ({ fullName, verifyUrl }) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Email Verification</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f5f7fa;
      padding: 20px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .btn {
      display: inline-block;
      margin-top: 16px;
      padding: 12px 20px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
    }
    .footer {
      margin-top: 28px;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
    }
    .signature {
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>Hello ${fullName},</p>

    <p>
      Thank you for registering. Please verify your email address by clicking
      the button below:
    </p>

    <a href="${verifyUrl}" class="btn">Verify Email</a>

    <p>If the button does not work, copy and paste this link into your browser:</p>
    <p>${verifyUrl}</p>

    <div class="signature">
      <p>Regards,<br/>
      <strong>Electrical Engineers’ Society</strong></p>
    </div>

    <div class="footer">
      <p>
        This is a system-generated email. Please do not reply to this message.
      </p>
      <p>
        This verification link will expire in 24 hours. If you did not create this
        account, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
`;
};