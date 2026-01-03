export const forgotPasswordTemplate = ({ fullName, otp }) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Password Reset OTP</title>
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
    .otp-box {
      margin: 20px 0;
      padding: 14px;
      background-color: #f1f5f9;
      border-radius: 6px;
      text-align: center;
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 2px;
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
      We received a request to reset your account password.
      Please use the OTP below to proceed with the password reset:
    </p>

    <div class="otp-box">
      ${otp}
    </div>

    <p>
      This OTP is valid for <strong>15 minutes</strong>.
      Please do not share this code with anyone.
    </p>

    <div class="signature">
      <p>Regards,<br/>
      <strong>Electrical Engineers’ Society</strong></p>
    </div>

    <div class="footer">
      <p>
        This is a system-generated email. Please do not reply to this message.
      </p>
      <p>
        If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
`;
};