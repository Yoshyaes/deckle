param([switch]$Apply)
$ErrorActionPreference = 'Stop'

# Ordered literal replacements to move the two PUBLISHED npm packages
# from the unavailable @deckle scope to @getdeckle. Internal workspace
# names (@deckle/api, @deckle/web, ...) are NOT touched. Python `deckle`
# and Ruby `deckle` are NOT touched (different ecosystems, names free there).
$subs = @(
    @{ find = '@deckle/sdk'; repl = '@getdeckle/sdk' },
    @{ find = '@deckle/react-pdf'; repl = '@getdeckle/react-pdf' },
    @{ find = 'npm install deckle'; repl = 'npm install @getdeckle/sdk' },
    @{ find = 'npm i deckle'; repl = 'npm i @getdeckle/sdk' },
    @{ find = "from 'deckle'"; repl = "from '@getdeckle/sdk'" },
    @{ find = 'from "deckle"'; repl = 'from "@getdeckle/sdk"' },
    @{ find = "require('deckle')"; repl = "require('@getdeckle/sdk')" },
    @{ find = 'require("deckle")'; repl = 'require("@getdeckle/sdk")' }
)

$excludePathFragments = @('deckle_rebrand/','deckle_rebrand\','.claude/','.claude\','audits/','audits\','scripts/rebrand.ps1','scripts/npm-rename.ps1')
$excludeFileNames = @('pnpm-lock.yaml','package-lock.json','go.sum')
$excludeExtensions = @('.png','.jpg','.jpeg','.gif','.ico','.pdf','.woff','.woff2','.ttf','.lock')
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$files = git ls-files | Where-Object {
    $p = $_
    foreach ($frag in $excludePathFragments) { if ($p -like "*$frag*") { return $false } }
    if ($excludeFileNames -contains (Split-Path -Leaf $p)) { return $false }
    if ($excludeExtensions -contains ([System.IO.Path]::GetExtension($p).ToLower())) { return $false }
    return $true
}

$report = New-Object System.Collections.Generic.List[object]
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
    $content = [System.IO.File]::ReadAllText($file)
    if ($content -notmatch "deckle") { continue }
    $original = $content
    $n = 0
    foreach ($s in $subs) {
        $before = $content
        $content = $content.Replace($s.find, $s.repl)
        if ($content -ne $before) { $n += ([regex]::Matches($before, [regex]::Escape($s.find))).Count }
    }
    if ($content -ne $original) {
        $report.Add([PSCustomObject]@{ File = $file; Hits = $n })
        if ($Apply) { [System.IO.File]::WriteAllText($file, $content, $utf8NoBom) }
    }
}
$report | Sort-Object Hits -Descending | Format-Table -AutoSize
Write-Host "Files: $($report.Count)  Total replacements: $(($report | Measure-Object Hits -Sum).Sum)"
if (-not $Apply) { Write-Host "[DRY RUN] re-run with -Apply" -ForegroundColor Magenta }
