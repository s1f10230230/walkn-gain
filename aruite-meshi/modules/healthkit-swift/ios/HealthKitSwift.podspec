Pod::Spec.new do |s|
  s.name           = 'HealthKitSwift'
  s.version        = '1.0.0'
  s.summary        = 'Native HealthKit module for Walk\'n Gain'
  s.description    = 'Swift module for efficient HealthKit data retrieval'
  s.author         = 'Walk\'n Gain'
  s.homepage       = 'https://github.com/example/healthkit-swift'
  s.platforms      = { :ios => '13.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '*.swift'
end
