import { accountSettingsService } from "../services/accountSettingsService.js";

const handleError = (res, error) => {
  const message = error?.message || "Failed to update account settings. Please try again.";
  const status = /required|valid/i.test(message) ? 400 : 500;
  res.status(status).json({ ok: false, error: message });
};

const getAccountSettings = (_req, res) => {
  try {
    const accountSettings = accountSettingsService.getAccountSettings();
    res.json({ ok: true, accountSettings });
  } catch (error) {
    handleError(res, error);
  }
};

const updateAccountSettings = (req, res) => {
  try {
    const result = accountSettingsService.updateAccountSettings(req.body || {});
    res.json({ ok: true, ...result });
  } catch (error) {
    handleError(res, error);
  }
};

export const accountSettingsController = {
  getAccountSettings,
  updateAccountSettings
};

export default accountSettingsController;
