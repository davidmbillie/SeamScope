param(
    [string]$OutputPath = '..\artifacts\evidence\pilot-v1\freeze-candidate-metadata.json',
    [ValidateSet('freeze-candidate', 'frozen')]
    [string]$Status = 'freeze-candidate',
    [string]$EmulatorSerial = 'emulator-5554',
    [string]$TabletSerial = '<TABLET_SERIAL>',
    [string]$ApkPath = '..\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk',
    [string]$FirmwareBinaryPath = ''
)

$ErrorActionPreference = 'Stop'
$automationRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $automationRoot

function Resolve-RepositoryPath {
    param([string]$Value)
    if ([System.IO.Path]::IsPathRooted($Value)) { return $Value }
    return [System.IO.Path]::GetFullPath((Join-Path $automationRoot $Value))
}

function Get-CommandText {
    param([string]$Command, [string[]]$Arguments = @())
    try {
        $previousPreference = $ErrorActionPreference
        $script:ErrorActionPreference = 'Continue'
        $output = (& $Command @Arguments 2>&1 | Out-String).Trim()
        $exitCode = $LASTEXITCODE
        $script:ErrorActionPreference = $previousPreference
        if ($exitCode -ne 0) {
            return "command-exit-$exitCode`: $output"
        }
        return $output
    } catch {
        $script:ErrorActionPreference = 'Stop'
        return "unavailable: $($_.Exception.Message)"
    }
}

function Get-AndroidProperty {
    param([string]$Serial, [string]$Property)
    return (Get-CommandText 'adb' @('-s', $Serial, 'shell', 'getprop', $Property))
}

function Get-HashRecord {
    param([string]$Label, [string]$Path)
    $resolved = Resolve-RepositoryPath $Path
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        return [ordered]@{ label = $Label; status = 'missing'; sha256 = $null; bytes = $null }
    }
    $item = Get-Item -LiteralPath $resolved
    return [ordered]@{
        label = $Label
        status = 'captured'
        sha256 = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = $item.Length
    }
}

function Get-SourceSnapshot {
    # The repository does not need an existing commit in order to identify the
    # exact pre-freeze source tree. Hash every non-ignored file Git would place
    # in the first commit, then hash the canonical path/hash inventory.
    $gitSafeRoot = $repositoryRoot.Replace('\', '/')
    $gitFiles = @(& git -c "safe.directory=$gitSafeRoot" -C $repositoryRoot ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) {
        return [ordered]@{
            status = 'unavailable'
            fileCount = 0
            sha256 = $null
        }
    }

    $records = @($gitFiles | Sort-Object | ForEach-Object {
        $relativePath = $_.Replace('\', '/')
        $absolutePath = Join-Path $repositoryRoot $_
        if (Test-Path -LiteralPath $absolutePath -PathType Leaf) {
            $hash = (Get-FileHash -LiteralPath $absolutePath -Algorithm SHA256).Hash.ToLowerInvariant()
            "$hash  $relativePath"
        }
    })
    if ($records.Count -eq 0) {
        return [ordered]@{
            status = 'unavailable'
            fileCount = 0
            sha256 = $null
        }
    }

    $canonical = ($records -join "`n") + "`n"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($canonical)
        $digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }

    return [ordered]@{
        status = 'captured'
        algorithm = 'sha256-of-sorted-sha256-path-inventory'
        fileCount = $records.Count
        sha256 = $digest
    }
}

$packageNames = @(
    'appium',
    'appium-uiautomator2-driver',
    'webdriverio',
    '@wdio/cli',
    'typescript'
)
$nodePackages = [ordered]@{}
foreach ($packageName in $packageNames) {
    $packageJson = Join-Path $automationRoot "node_modules\$packageName\package.json"
    $nodePackages[$packageName] = if (Test-Path -LiteralPath $packageJson) {
        (Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json).version
    } else {
        'missing'
    }
}

$emulatorExe = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'
$arduinoCli = 'C:\Program Files\Arduino CLI\arduino-cli.exe'
$bumblePython = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python39\python.exe'
$javaDetails = Get-CommandText 'java' @('-version')
$javaVersion = [regex]::Match($javaDetails, '(?i)(?:openjdk|java) version "[^"]+"').Value
$emulatorDetails = Get-CommandText $emulatorExe @('-version')
$emulatorVersion = [regex]::Match($emulatorDetails, 'Android emulator version [^\r\n]+').Value
$artifacts = [ordered]@{
    applicationApk = Get-HashRecord 'apps/mobile Android debug APK' $ApkPath
    firmwareSource = Get-HashRecord 'Nano ESP32 firmware source' '..\firmware\seamscope_peripheral\seamscope_peripheral.ino'
    runPlan = Get-HashRecord 'pilot-v1 confirmatory run plan' '.\evidence\plans\pilot-v1-confirmatory.json'
    automationLock = Get-HashRecord 'automation dependency lock' '.\package-lock.json'
    mobileLock = Get-HashRecord 'mobile dependency lock' '..\apps\mobile\package-lock.json'
}
if (-not [string]::IsNullOrWhiteSpace($FirmwareBinaryPath)) {
    $artifacts.firmwareApplicationBinary = Get-HashRecord 'Nano ESP32 application binary' $FirmwareBinaryPath
    if ($FirmwareBinaryPath.EndsWith('.ino.bin')) {
        $artifacts.firmwareBootloaderBinary = Get-HashRecord 'Nano ESP32 bootloader binary' ($FirmwareBinaryPath.Replace('.ino.bin', '.ino.bootloader.bin'))
        $artifacts.firmwarePartitionsBinary = Get-HashRecord 'Nano ESP32 partition-table binary' ($FirmwareBinaryPath.Replace('.ino.bin', '.ino.partitions.bin'))
    }
}

$metadata = [ordered]@{
    schemaVersion = '1'
    status = $Status
    capturedAt = [DateTime]::UtcNow.ToString('o')
    repositoryState = 'uncommitted-hash-snapshot'
    sourceSnapshot = Get-SourceSnapshot
    host = [ordered]@{
        os = [Environment]::OSVersion.VersionString
        powershell = $PSVersionTable.PSVersion.ToString()
        node = Get-CommandText 'node' @('--version')
        npm = Get-CommandText 'npm' @('--version')
        java = if ($javaVersion) { $javaVersion } else { $javaDetails }
    }
    automation = [ordered]@{
        packages = $nodePackages
        bumble = Get-CommandText $bumblePython @('-c', "import importlib.metadata as m; print(m.version('bumble'))")
        bumbleBridge = [ordered]@{
            hostTransport = 'android-netsim:_:8877,mode=controller'
            controllerTransport = 'usb:0B05:190E/<CONTROLLER_SERIAL>'
        }
        adb = Get-CommandText 'adb' @('version')
        emulator = if ($emulatorVersion) { $emulatorVersion } else { $emulatorDetails }
        arduinoCli = Get-CommandText $arduinoCli @('version')
        arduinoCores = Get-CommandText $arduinoCli @('core', 'list')
    }
    androidTargets = [ordered]@{
        emulator = [ordered]@{
            serial = $EmulatorSerial
            model = Get-AndroidProperty $EmulatorSerial 'ro.product.model'
            release = Get-AndroidProperty $EmulatorSerial 'ro.build.version.release'
            sdk = Get-AndroidProperty $EmulatorSerial 'ro.build.version.sdk'
            fingerprint = Get-AndroidProperty $EmulatorSerial 'ro.build.fingerprint'
        }
        tablet = [ordered]@{
            serial = $TabletSerial
            model = Get-AndroidProperty $TabletSerial 'ro.product.model'
            release = Get-AndroidProperty $TabletSerial 'ro.build.version.release'
            sdk = Get-AndroidProperty $TabletSerial 'ro.build.version.sdk'
            fingerprint = Get-AndroidProperty $TabletSerial 'ro.build.fingerprint'
        }
    }
    fixture = [ordered]@{
        board = 'Arduino Nano ESP32'
        serialPort = 'COM3'
        baudRate = 115200
    }
    emulatorLaunch = [ordered]@{
        avdHome = 'D:\SeamScope\android-avd'
        emulatorHome = (Join-Path $repositoryRoot '.cache\android-emulator-home')
        avd = 'Pixel_6'
        packetStreamerEndpoint = 'localhost:8877'
        metroDebugHost = '127.0.0.1:8081 via adb reverse'
        headless = $true
        gpu = 'swiftshader_indirect'
        snapshot = 'disabled'
    }
    artifacts = $artifacts
}

$resolvedOutput = Resolve-RepositoryPath $OutputPath
$parent = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $parent -Force | Out-Null
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutput -Encoding utf8
Write-Output $resolvedOutput
