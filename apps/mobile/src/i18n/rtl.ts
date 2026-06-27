import { I18nManager, Platform } from 'react-native';

/**
 * Force RTL globally for Wathba. Call once at app boot, before any UI
 * mounts. On native, this only takes full effect after a reload (Expo Go
 * handles the reload automatically in dev; production users get it on
 * first launch since the binary ships RTL-on).
 */
export function ensureRtl(): void {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    if (Platform.OS === 'web') {
      // Web: set <html dir="rtl"> so CSS logical props work.
      if (typeof document !== 'undefined') {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
      }
    }
  }
}
