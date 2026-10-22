param(
    [Parameter(Mandatory = $true)]
    [string]$Port,
    [int]$BaudRate = 115200,
    [int]$ListenPort = 8765
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

$listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    $ListenPort
)
$encoding = [System.Text.UTF8Encoding]::new($false)
$client = $null
$stream = $null
$serialBuffer = ''
$commandBuffer = ''

function Write-ClientLine {
    param([string]$Line)

    if ($null -eq $script:stream) {
        return
    }
    try {
        $bytes = $script:encoding.GetBytes("$Line`n")
        $script:stream.Write($bytes, 0, $bytes.Length)
        $script:stream.Flush()
    } catch {
        Close-Client
    }
}

function Close-Client {
    if ($null -ne $script:stream) {
        $script:stream.Dispose()
        $script:stream = $null
    }
    if ($null -ne $script:client) {
        $script:client.Dispose()
        $script:client = $null
    }
    $script:commandBuffer = ''
}

function Publish-SerialLine {
    param([string]$Line)

    if ($Line.Length -eq 0) {
        return
    }
    [Console]::Out.WriteLine($Line)
    [Console]::Out.Flush()
    Write-ClientLine -Line $Line
}

try {
    $serial.Open()
    $listener.Start()
    [Console]::Out.WriteLine("SERIAL DAEMON READY 127.0.0.1:$ListenPort ($Port)")
    [Console]::Out.Flush()

    while ($true) {
        if ($null -eq $client -and $listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $client.NoDelay = $true
            $stream = $client.GetStream()
            $commandBuffer = ''
            Write-ClientLine -Line 'BRIDGE READY'
        }

        $chunk = $serial.ReadExisting()
        if ($chunk.Length -gt 0) {
            $serialBuffer += $chunk
            while ($serialBuffer.Contains("`n")) {
                $separator = $serialBuffer.IndexOf("`n")
                $line = $serialBuffer.Substring(0, $separator).TrimEnd("`r")
                $serialBuffer = $serialBuffer.Substring($separator + 1)
                Publish-SerialLine -Line $line
            }
        }

        if ($null -ne $client) {
            if ($stream.DataAvailable) {
                $buffer = [byte[]]::new(4096)
                $count = $stream.Read($buffer, 0, $buffer.Length)
                if ($count -eq 0) {
                    Close-Client
                } else {
                    $commandBuffer += $encoding.GetString($buffer, 0, $count)
                    while ($commandBuffer.Contains("`n")) {
                        $separator = $commandBuffer.IndexOf("`n")
                        $command = $commandBuffer.Substring(0, $separator).TrimEnd("`r")
                        $commandBuffer = $commandBuffer.Substring($separator + 1)
                        if ($command -eq '__CLOSE__') {
                            Close-Client
                            break
                        }
                        if ($command.Length -gt 0) {
                            $serial.WriteLine($command)
                        }
                    }
                }
            } elseif ($client.Client.Poll(0, [System.Net.Sockets.SelectMode]::SelectRead) -and $client.Client.Available -eq 0) {
                Close-Client
            }
        }

        Start-Sleep -Milliseconds 10
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    Close-Client
    $listener.Stop()
    if ($serial.IsOpen) {
        $serial.Close()
    }
    $serial.Dispose()
}
