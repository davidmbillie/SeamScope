param(
    [ValidateSet('injected', 'bumble-ble', 'tablet-ble')]
    [string]$Route = 'bumble-ble',
    [int]$SerialDaemonPort = 8765,
    [int]$BumblePort = 8877,
    [string]$AndroidSerial = '',
    [string]$BumbleLog = ''
)

$ErrorActionPreference = 'Stop'

function New-Check {
    param(
        [string]$Name,
        [ValidateSet('ready', 'not-ready', 'deferred', 'not-applicable')]
        [string]$Status,
        [string]$Evidence
    )
    [ordered]@{ name = $Name; status = $Status; evidence = $Evidence }
}

function Test-SerialDaemon {
    param([int]$Port)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connect = $client.ConnectAsync('127.0.0.1', $Port)
        if (-not $connect.Wait(2000)) {
            throw "connection timed out"
        }
        $client.ReceiveTimeout = 2000
        $client.SendTimeout = 2000
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)
        $writer = [System.IO.StreamWriter]::new($stream, [System.Text.UTF8Encoding]::new($false))
        $writer.AutoFlush = $true

        $ready = $reader.ReadLine()
        if ($ready -ne 'BRIDGE READY') {
            throw "unexpected daemon greeting: $ready"
        }
        $writer.WriteLine('STATUS')
        $deadline = [DateTime]::UtcNow.AddSeconds(2)
        do {
            $line = $reader.ReadLine()
            if ($line -match '^STATUS SPEED .+ SEQUENCE \d+$') {
                $writer.WriteLine('__CLOSE__')
                return New-Check 'serial-availability' 'ready' $line
            }
        } while ([DateTime]::UtcNow -lt $deadline)
        throw 'fixture did not return a STATUS record'
    } catch {
        return New-Check 'serial-availability' 'not-ready' $_.Exception.Message
    } finally {
        $client.Dispose()
    }
}

function Get-BluetoothState {
    param([string]$Serial)

    if ([string]::IsNullOrWhiteSpace($Serial)) {
        return New-Check 'android-bluetooth-state' 'not-ready' 'AndroidSerial was not supplied'
    }
    $output = (& adb -s $Serial shell dumpsys bluetooth_manager 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        return New-Check 'android-bluetooth-state' 'not-ready' $output.Trim()
    }
    $on = $output -match 'state:\s*ON' -or $output -match 'enabled:\s*true'
    return New-Check 'android-bluetooth-state' $(if ($on) {'ready'} else {'not-ready'}) $(
        if ($on) {'Android Bluetooth manager reports ON/enabled'} else {'Android Bluetooth manager does not report ON/enabled'}
    )
}

$checks = [System.Collections.Generic.List[object]]::new()

if ($Route -eq 'injected') {
    $checks.Add((New-Check 'serial-availability' 'not-applicable' 'Injected route does not use the fixture'))
} else {
    $checks.Add((Test-SerialDaemon -Port $SerialDaemonPort))
}

if ($Route -eq 'bumble-ble') {
    # ADB exposes only the emulator instance that owns its console ports. A
    # failed headless launch can leave a second QEMU backend alive without an
    # ADB target, so `adb devices` alone cannot establish unique ownership of
    # the packet-streamer route.
    $qemuProcesses = @(Get-Process -Name 'qemu-system-x86_64-headless' -ErrorAction SilentlyContinue)
    $qemuReady = $qemuProcesses.Count -eq 1
    $qemuEvidence = if ($qemuProcesses.Count -eq 0) {
        'No headless Android emulator backend is running'
    } else {
        "count=$($qemuProcesses.Count); pids=$((@($qemuProcesses.Id) -join ','))"
    }
    $checks.Add((New-Check 'emulator-backend-uniqueness' $(if ($qemuReady) {'ready'} else {'not-ready'}) $qemuEvidence))

    # netstat is used here because Get-NetTCPConnection may return no rows to a
    # non-elevated collection shell on Windows. Count only the server-side row
    # whose local endpoint is BumblePort, not both halves of the loopback pair.
    $tcpRows = @(netstat -ano | ForEach-Object {
        $fields = @($_.Trim() -split '\s+')
        if ($fields.Count -ge 5 -and $fields[0] -eq 'TCP') {
            [pscustomobject]@{
                LocalEndpoint = $fields[1]
                State = $fields[3]
            }
        }
    })
    $localPortSuffix = ":$BumblePort"
    $listening = @($tcpRows | Where-Object {
        $_.LocalEndpoint.EndsWith($localPortSuffix) -and $_.State -eq 'LISTENING'
    })
    $established = @($tcpRows | Where-Object {
        $_.LocalEndpoint.EndsWith($localPortSuffix) -and $_.State -eq 'ESTABLISHED'
    })
    $tcpReady = $established.Count -eq 1
    $tcpEvidence = "listeners=$($listening.Count); established=$($established.Count)"
    $checks.Add((New-Check 'bumble-tcp' $(if ($tcpReady) {'ready'} else {'not-ready'}) $tcpEvidence))

    if (-not [string]::IsNullOrWhiteSpace($BumbleLog) -and (Test-Path -LiteralPath $BumbleLog)) {
        # The INFO-level bridge log can accumulate thousands of advertising
        # report lines after a responsive controller completes startup. Search
        # the bounded current-session file rather than an arbitrary line tail.
        $hciReady = [bool](Select-String -LiteralPath $BumbleLog -Pattern 'HCI_COMMAND_COMPLETE_EVENT' -Quiet)
        $hciEvidence = if ($hciReady) {
            'Current Bumble session log contains a controller-to-host HCI command-complete event'
        } else {
            'No HCI command-complete event found in the current Bumble session log'
        }
        $checks.Add((New-Check 'hci-responsiveness' $(if ($hciReady) {'ready'} else {'not-ready'}) $hciEvidence))
    } else {
        $checks.Add((New-Check 'hci-responsiveness' 'not-ready' 'Current Bumble session log was not supplied or does not exist'))
    }
} else {
    $checks.Add((New-Check 'bumble-tcp' 'not-applicable' 'Route does not use Bumble'))
    $checks.Add((New-Check 'hci-responsiveness' 'not-applicable' 'Route does not use Bumble'))
}

if ($Route -eq 'injected') {
    $checks.Add((New-Check 'android-bluetooth-state' 'not-applicable' 'Injected route does not use Android Bluetooth'))
} else {
    $checks.Add((Get-BluetoothState -Serial $AndroidSerial))
}

$checks.Add((New-Check 'gatt-readiness' 'deferred' 'Established by SUBSCRIBED inside the 8,000 ms in-run setup boundary'))
$checks.Add((New-Check 'application-readiness' 'deferred' 'Established by the Appium setup-ready event inside the 45,000 ms startup boundary'))

$requiredFailures = @($checks | Where-Object { $_.status -eq 'not-ready' })
$result = [ordered]@{
    schemaVersion = '1'
    observedAt = [DateTime]::UtcNow.ToString('o')
    route = $Route
    androidSerial = if ([string]::IsNullOrWhiteSpace($AndroidSerial)) { $null } else { $AndroidSerial }
    readyForInRunChecks = $requiredFailures.Count -eq 0
    checks = $checks
}
$result | ConvertTo-Json -Depth 6
if ($requiredFailures.Count -gt 0) {
    exit 1
}
