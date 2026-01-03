export const changePasswordTemplate = ({
  fullName,
  time,
  ip,
  device,
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Password Changed Successfully</title>
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
    .info-box {
      margin: 20px 0;
      padding: 14px;
      background-color: #f1f5f9;
      border-radius: 6px;
      font-size: 14px;
      line-height: 1.6;
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
      This is a confirmation that your account password was
      <strong>successfully changed</strong>.
    </p>

    <div class="info-box">
      <p><strong>Date & Time:</strong> ${time}</p>
      <p><strong>IP Address:</strong> ${ip}</p>
      <p><strong>Device:</strong> ${device}</p>
    </div>

    <p>
      If you made this change, no further action is required.
      If you did <strong>not</strong> change your password,
      please reset it immediately and contact support.
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
        For security reasons, we recommend keeping your account credentials confidential.
      </p>
    </div>
  </div>
</body>
</html>
`;
};