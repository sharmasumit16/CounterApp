require "json"

package = JSON.parse(File.read(File.join(__dir__, "../../package.json")))

Pod::Spec.new do |s|
  s.name            = "CounterTurboModule"
  s.version         = package["version"]
  s.summary         = "Native C++ counter logic exposed as a React Native TurboModule"
  s.homepage        = "https://github.com/your-username/CounterApp"
  s.license         = { :type => "MIT" }
  s.author          = { "Author" => "author@example.com" }
  s.platform        = :ios, "13.4"
  s.source          = { :path => "." }

  s.source_files    = "*.{h,cpp,mm}"

  # ARC ON for CounterTurboModule.mm; .cpp files are unaffected.
  s.requires_arc    = true

  # Only React-Core is needed — it pulls in RCTBridgeModule and RCTEventEmitter.
  # Do NOT list React-RCTFabric or React-Codegen here; in the RN 0.85 prebuilt
  # setup those are already baked in and re-declaring them causes linkage conflicts
  # that prevent PlatformConstants (and other core TurboModules) from registering.
  s.dependency "React-Core"
end
