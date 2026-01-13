#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PaywallModule, NSObject)

RCT_EXTERN_METHOD(showPaywall:(BOOL)trialEligible
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(showPaywallSheet:(BOOL)trialEligible
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
