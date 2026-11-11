$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = "E:\realssa-main (2)\realssa-main"
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$action = {
    $path = $Event.SourceEventArgs.FullPath
    Write-Host "Change detected in $path. Pushing to GitHub..."
    git add .
    git commit -m "Auto-update from monitor"
    git push origin main
}

Register-ObjectEvent $watcher "Changed" -Action $action
Register-ObjectEvent $watcher "Created" -Action $action

while ($true) { Start-Sleep -Seconds 5 }
