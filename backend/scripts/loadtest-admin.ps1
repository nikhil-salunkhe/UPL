$ProgressPreference = 'SilentlyContinue'
$login = Invoke-RestMethod -Uri 'http://localhost:5000/api/admin/login' -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}' -TimeoutSec 10
$tok = $login.token
$ah = @{ Authorization = "Bearer $tok" }

Write-Output '=== 1) Admin dashboard endpoints: payload + latency (serial, cold) ==='
$eps = @(
  @{ u = '/api/players/all?page=1&limit=25&status=all'; a = $true },
  @{ u = '/api/players/all?page=1&limit=1000'; a = $true },
  @{ u = '/api/owners'; a = $false },
  @{ u = '/api/sponsors'; a = $false },
  @{ u = '/api/advertisements/all'; a = $true },
  @{ u = '/api/rules/all'; a = $true },
  @{ u = '/api/tournament'; a = $false },
  @{ u = '/api/matches'; a = $false }
)
$total = 0
foreach ($e in $eps) {
  $hh = if ($e.a) { $ah } else { @{} }
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-WebRequest -Uri ('http://localhost:5000' + $e.u) -UseBasicParsing -Headers $hh -TimeoutSec 60
  $sw.Stop()
  $total += $sw.ElapsedMilliseconds
  Write-Output ('{0,-52} {1,10} bytes {2,6} ms' -f $e.u, $r.RawContentLength, $sw.ElapsedMilliseconds)
}
Write-Output ("TOTAL serial first-load: {0} ms" -f $total)

Write-Output ''
Write-Output '=== 2) Cache headers: auth vs anonymous ==='
$r = Invoke-WebRequest -Uri 'http://localhost:5000/api/players/all?page=1&limit=25&status=all' -UseBasicParsing -Headers $ah -TimeoutSec 30
Write-Output ("players/all (auth)     cache-control: {0}" -f $r.Headers['Cache-Control'])
$r = Invoke-WebRequest -Uri 'http://localhost:5000/api/rules/all' -UseBasicParsing -Headers $ah -TimeoutSec 30
Write-Output ("rules/all (auth)       cache-control: {0}" -f $r.Headers['Cache-Control'])
$r = Invoke-WebRequest -Uri 'http://localhost:5000/api/players' -UseBasicParsing -TimeoutSec 30
Write-Output ("players (anonymous)    cache-control: {0}" -f $r.Headers['Cache-Control'])
$r = Invoke-WebRequest -Uri 'http://localhost:5000/api/owners' -UseBasicParsing -Headers $ah -TimeoutSec 30
Write-Output ("owners (auth)          cache-control: {0}" -f $r.Headers['Cache-Control'])

Write-Output ''
Write-Output '=== 3) Burst: 60 parallel mixed requests (simulate 10 admins x 6 calls) ==='
Add-Type -AssemblyName System.Net.Http
$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(60)
$ahNet = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $tok)
$urls = @()
for ($i = 0; $i -lt 60; $i++) {
  $which = $i % 6
  $u = switch ($which) {
    0 { '/api/players/all?page=1&limit=25&status=all' }
    1 { '/api/owners' }
    2 { '/api/sponsors' }
    3 { '/api/advertisements/all' }
    4 { '/api/rules/all' }
    5 { '/api/matches' }
  }
  if ($which -in 0, 3, 4) { $client.DefaultRequestHeaders.Authorization = $ahNet } else { $client.DefaultRequestHeaders.Authorization = $null }
  $urls += [pscustomobject]@{ Url = 'http://localhost:5000' + $u; Auth = ($which -in 0, 3, 4) }
}
# Set auth per-request via HttpRequestMessage instead of mutating default headers
$tasks = @()
$sw = [System.Diagnostics.Stopwatch]::StartNew()
foreach ($x in $urls) {
  $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, $x.Url)
  if ($x.Auth) { $req.Headers.Authorization = $ahNet }
  $tasks += $client.SendAsync($req)
}
[System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tasks, 60000) | Out-Null
$ok = ($tasks | Where-Object { $_.Status -eq 'RanToCompletion' -and $_.Result.IsSuccessStatusCode }).Count
$bad = 60 - $ok
$sw.Stop()
$client.Dispose()
Write-Output ("60 parallel requests: ok={0} failed={1} wall={2} ms" -f $ok, $bad, $sw.ElapsedMilliseconds)

Write-Output ''
Write-Output '=== 4) Latency percentiles of 30 sequential warm calls to /api/owners ==='
$times = @()
for ($i = 0; $i -lt 30; $i++) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Invoke-WebRequest -Uri 'http://localhost:5000/api/owners' -UseBasicParsing -TimeoutSec 30 | Out-Null
  $sw.Stop()
  $times += $sw.ElapsedMilliseconds
}
$sorted = $times | Sort-Object
$p50 = $sorted[[int](30 * 0.5)]
$p95 = $sorted[[int](30 * 0.95)]
Write-Output ("min={0} p50={1} p95={2} max={3} ms" -f $sorted[0], $p50, $p95, $sorted[29])

Write-Output ''
Write-Output '=== 5) Login limiter headers present on /api/admin/login? ==='
try {
  Invoke-WebRequest -Uri 'http://localhost:5000/api/admin/login' -Method Post -ContentType 'application/json' -Body '{"username":"x","password":"y"}' -UseBasicParsing -TimeoutSec 10 | Out-Null
  Write-Output 'unexpected 200'
} catch {
  $resp = $_.Exception.Response
  Write-Output ("status={0} RateLimit-Limit={1} RateLimit-Remaining={2}" -f [int]$resp.StatusCode, $resp.Headers['RateLimit-Limit'], $resp.Headers['RateLimit-Remaining'])
}
