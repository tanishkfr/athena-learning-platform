param([switch]$Production)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (-not (Test-Path -LiteralPath $ollamaExe)) { throw 'Install Ollama from its official website first.' }
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_NOPRUNE = '1'
$env:LLAMA_ARG_REPACK = '0'
$env:LLAMA_ARG_MMAP = '1'
$localRunner = $null
try {
  try { Invoke-RestMethod 'http://127.0.0.1:11435/api/tags' -TimeoutSec 3 | Out-Null }
  catch {
    $localRunner = Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      Start-Sleep -Milliseconds 500
      try { Invoke-RestMethod 'http://127.0.0.1:11435/api/tags' -TimeoutSec 2 | Out-Null; $ready = $true; break } catch {}
    }
    if (-not $ready) { throw 'The isolated local model server did not start.' }
  }
  $env:OLLAMA_BASE_URL = 'http://127.0.0.1:11435'
  $env:ATHENA_MODEL = 'llama3.2:3b'
  if ($Production) { npm start } else { npm run dev }
  if ($LASTEXITCODE -ne 0) { throw "Athena exited with code $LASTEXITCODE." }
} finally {
  if ($localRunner -and -not $localRunner.HasExited) { Stop-Process -Id $localRunner.Id }
}

