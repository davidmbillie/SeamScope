$ErrorActionPreference = 'Stop'

$automationRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $automationRoot
$releaseParent = Join-Path $repositoryRoot 'artifacts\release'
$folderName = 'seamscope-v1.0.0-evidence'
$sourceFolder = Join-Path $releaseParent $folderName
$archivePath = Join-Path $releaseParent "$folderName.zip"
$temporaryPath = Join-Path $releaseParent "$folderName.portable.zip"
$checksumPath = "$archivePath.sha256"

if (-not (Test-Path -LiteralPath $sourceFolder -PathType Container)) {
  throw "Release folder is missing: $sourceFolder"
}

& node (Join-Path $PSScriptRoot 'build-release-evidence.mjs') --verify
if ($LASTEXITCODE -ne 0) {
  throw 'The release folder failed verification.'
}

if (Test-Path -LiteralPath $temporaryPath) {
  Remove-Item -LiteralPath $temporaryPath -Force
}

Push-Location $releaseParent
try {
  & tar.exe -a -cf $temporaryPath $folderName
  if ($LASTEXITCODE -ne 0) {
    throw 'tar.exe failed to create the portable ZIP archive.'
  }
} finally {
  Pop-Location
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($temporaryPath)
try {
  $fileEntries = @($archive.Entries | Where-Object {
    -not [string]::IsNullOrEmpty($_.Name)
  })
  $backslashEntries = @($archive.Entries | Where-Object {
    $_.FullName.Contains('\')
  })
  if ($backslashEntries.Count -ne 0) {
    throw 'The ZIP contains non-portable backslash entry names.'
  }

  $inventoryEntry = $fileEntries | Where-Object {
    $_.FullName -eq "$folderName/checksums.sha256"
  }
  if ($null -eq $inventoryEntry) {
    throw 'The package checksum inventory is missing from the ZIP.'
  }

  $reader = [System.IO.StreamReader]::new($inventoryEntry.Open())
  try {
    $inventoryText = $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
  $expected = @{}
  foreach ($line in ($inventoryText -split "`n")) {
    if ($line -match '^([0-9a-f]{64})  (.+)$') {
      $expected[$Matches[2]] = $Matches[1]
    }
  }

  $verified = 0
  foreach ($entry in $fileEntries) {
    if ($entry -eq $inventoryEntry) {
      continue
    }
    $relativePath = $entry.FullName -replace "^$([regex]::Escape($folderName))/", ''
    if (-not $expected.ContainsKey($relativePath)) {
      throw "ZIP entry is absent from the checksum inventory: $relativePath"
    }
    $stream = $entry.Open()
    try {
      $hasher = [System.Security.Cryptography.SHA256]::Create()
      try {
        $actual = ([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
      } finally {
        $hasher.Dispose()
      }
    } finally {
      $stream.Dispose()
    }
    if ($actual -ne $expected[$relativePath]) {
      throw "ZIP entry hash mismatch: $relativePath"
    }
    $verified += 1
  }
  if ($verified -ne $expected.Count) {
    throw "Expected $($expected.Count) checksummed files; verified $verified."
  }
} finally {
  $archive.Dispose()
}

Move-Item -LiteralPath $temporaryPath -Destination $archivePath -Force
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$sidecar = "$archiveHash  $([System.IO.Path]::GetFileName($archivePath))`n"
[System.IO.File]::WriteAllText($checksumPath, $sidecar, [System.Text.UTF8Encoding]::new($false))

Write-Output "Archived $verified checksummed files to $archivePath"
Write-Output "SHA-256: $archiveHash"

