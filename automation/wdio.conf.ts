const deviceUdid = process.env.SEAMSCOPE_DEVICE_UDID;
const externalAppium = process.env.SEAMSCOPE_APPIUM_EXTERNAL === 'true';
const appiumPort = Number(process.env.SEAMSCOPE_APPIUM_PORT ?? 4723);

export const config: WebdriverIO.Config = {
  runner: 'local',
  hostname: '127.0.0.1',
  port: appiumPort,
  path: '/',
  specs: ['./test/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.SEAMSCOPE_DEVICE_NAME ?? 'Android',
      ...(deviceUdid ? {'appium:udid': deviceUdid} : {}),
      'appium:appPackage': 'com.seamscope',
      'appium:appActivity': '.MainActivity',
      'appium:noReset': true,
      'appium:newCommandTimeout': 120,
    },
  ],
  logLevel: 'info',
  framework: 'mocha',
  reporters: ['spec'],
  services: externalAppium ? [] : [['appium', {command: 'appium'}]],
  waitforTimeout: Number(
    process.env.SEAMSCOPE_UI_TRANSITION_TIMEOUT_MS ?? 10_000,
  ),
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  mochaOpts: {
    timeout: 60_000,
  },
};
