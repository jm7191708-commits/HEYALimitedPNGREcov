import { dashboardSettingsStore } from "../dashboard-settings-store.js";

const getAccountSettings = () => dashboardSettingsStore.getAccountSettings();

const updateAccountSettings = (payload = {}) => dashboardSettingsStore.updateAccountSettings(payload);

export const accountSettingsService = {
  getAccountSettings,
  updateAccountSettings
};

export default accountSettingsService;
