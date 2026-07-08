const isValidOTP = (otp) => {
  if (!otp || typeof otp !== 'string' && typeof otp !== 'number') return false;
  const otpString = String(otp).trim();
  const otpRegex = /^\d{6}$/;
  return otpRegex.test(otpString);
};
module.exports = isValidOTP;