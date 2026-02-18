import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY_IOS = 'YOUR_REVENUECAT_IOS_API_KEY';
const ENTITLEMENT_ID = 'bakers_table';

interface SubscriptionContextValue {
  isPro: boolean;
  loading: boolean;
  offerings: PurchasesPackage[];
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  initialized: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isPro: false,
  loading: true,
  offerings: [],
  purchase: async () => false,
  restore: async () => false,
  initialized: false,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        if (Platform.OS === 'ios') {
          Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
        }
        const customerInfo = await Purchases.getCustomerInfo();
        checkEntitlement(customerInfo);

        const offeringsResult = await Purchases.getOfferings();
        if (offeringsResult.current?.availablePackages) {
          setOfferings(offeringsResult.current.availablePackages);
        }
        setInitialized(true);
      } catch (e) {
        // RevenueCat not configured yet — default to free tier
        console.log('RevenueCat init skipped:', e);
        setInitialized(true);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function checkEntitlement(info: CustomerInfo) {
    const entitlement = info.entitlements.active[ENTITLEMENT_ID];
    setIsPro(entitlement !== undefined);
  }

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      checkEntitlement(customerInfo);
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e: any) {
      if (!e.userCancelled) {
        console.error('Purchase error:', e);
      }
      return false;
    }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      checkEntitlement(customerInfo);
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      console.error('Restore error:', e);
      return false;
    }
  }, []);

  return (
    <SubscriptionContext.Provider value={{ isPro, loading, offerings, purchase, restore, initialized }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}
