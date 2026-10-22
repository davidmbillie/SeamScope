param(
    [Parameter(Mandatory = $true)]
    [string]$Port,
    [int]$BaudRate = 115200
)

$serial = [System.IO.Ports.SerialPort]::new(
    $Port,
    $BaudRate,
    [System.IO.Ports.Parity]::None,
    8,
    [System.IO.Ports.StopBits]::One
)
$serial.NewLine = "`n"
$serial.DtrEnable = $true
$serial.RtsEnable = $false

function Copy-SerialOutput {
    param([int]$MaximumMilliseconds = 1500)

    $deadline = [DateTime]::UtcNow.AddMilliseconds($MaximumMilliseconds)
    $quietSince = [DateTime]::UtcNow
    $buffer = ''
    while ([DateTime]::UtcNow -lt $deadline) {
        $chunk = $serial.ReadExisting()
        if ($chunk.Length -gt 0) {
            $buffer += $chunk
            $quietSince = [DateTime]::UtcNow
            while ($buffer.Contains("`n")) {
                $separator = $buffer.IndexOf("`n")
                $line = $buffer.Substring(0, $separator).TrimEnd("`r")
                $buffer = $buffer.Substring($separator + 1)
                if ($line.Length -gt 0) {
                    [Console]::Out.WriteLine($line)
                    [Console]::Out.Flush()
                }
            }
        } elseif ([DateTime]::UtcNow -gt $quietSince.AddMilliseconds(250)) {
            break
        }
        Start-Sleep -Milliseconds 20
    }
}

try {
    $serial.Open()
    Start-Sleep -Milliseconds 300
    Copy-SerialOutput -MaximumMilliseconds 500
    [Console]::Out.WriteLine('BRIDGE READY')
    [Console]::Out.Flush()

    while (($command = [Console]::In.ReadLine()) -ne $null) {
        if ($command -eq '__CLOSE__') {
            break
        }
        $serial.WriteLine($command)
        Copy-SerialOutput
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    if ($serial.IsOpen) {
        $serial.Close()
    }
    $serial.Dispose()
}
