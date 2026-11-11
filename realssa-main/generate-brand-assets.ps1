$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$public = Join-Path $root 'public'
$images = Join-Path $public 'images'
New-Item -ItemType Directory -Force -Path $images | Out-Null

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-StarPoints([float]$cx, [float]$cy, [float]$outer, [float]$inner) {
  return @(
    [System.Drawing.PointF]::new($cx, $cy - $outer),
    [System.Drawing.PointF]::new($cx + $inner, $cy - $inner),
    [System.Drawing.PointF]::new($cx + $outer, $cy),
    [System.Drawing.PointF]::new($cx + $inner, $cy + $inner),
    [System.Drawing.PointF]::new($cx, $cy + $outer),
    [System.Drawing.PointF]::new($cx - $inner, $cy + $inner),
    [System.Drawing.PointF]::new($cx - $outer, $cy),
    [System.Drawing.PointF]::new($cx - $inner, $cy - $inner)
  )
}

function New-StarBrush([float]$x, [float]$y, [float]$w, [float]$h) {
  $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
  return New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.ColorTranslator]::FromHtml('#FDE68A'),
    [System.Drawing.ColorTranslator]::FromHtml('#B45309'),
    45.0
  )
}

# ── 512x512 app / header icon ──────────────────────────────────────────────
$logo = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($logo)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$bgPath = New-RoundedPath 0 0 512 512 112
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  [System.Drawing.RectangleF]::new(0, 0, 512, 512),
  [System.Drawing.ColorTranslator]::FromHtml('#101017'),
  [System.Drawing.ColorTranslator]::FromHtml('#050507'),
  90.0
)
$g.FillPath($bgBrush, $bgPath)

$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 245, 158, 11), 5)
$g.DrawPath($borderPen, $bgPath)

$ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(38, 245, 158, 11), 6)
$g.DrawEllipse($ringPen, 58, 58, 396, 396)

$starPoints = New-StarPoints 256 256 180 62
$starBrush = New-StarBrush 76 76 360 360
$g.FillPolygon($starBrush, $starPoints)

$centerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#07070A'))
$g.FillEllipse($centerBrush, 226, 226, 60, 60)
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F59E0B'))
$g.FillEllipse($dotBrush, 246, 246, 20, 20)

$logo.Save((Join-Path $public 'logo.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$logo.Dispose()
$bgPath.Dispose()
$bgBrush.Dispose()
$borderPen.Dispose()
$ringPen.Dispose()
$starBrush.Dispose()
$centerBrush.Dispose()
$dotBrush.Dispose()

# ── 1200x630 social / article fallback cover ───────────────────────────────
$cover = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($cover)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$coverBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  [System.Drawing.RectangleF]::new(0, 0, 1200, 630),
  [System.Drawing.ColorTranslator]::FromHtml('#0B0B12'),
  [System.Drawing.ColorTranslator]::FromHtml('#1A1206'),
  20.0
)
$g.FillRectangle($coverBg, 0, 0, 1200, 630)

$faintPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(22, 245, 158, 11), 3)
$g.DrawEllipse($faintPen, 760, -90, 720, 720)
$g.DrawEllipse($faintPen, 870, 30, 520, 520)

$coverStar = New-StarPoints 210 315 140 48
$coverStarBrush = New-StarBrush 70 175 280 280
$g.FillPolygon($coverStarBrush, $coverStar)

$coverCenter = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#07070A'))
$g.FillEllipse($coverCenter, 186, 291, 48, 48)
$coverDot = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F59E0B'))
$g.FillEllipse($coverDot, 202, 307, 16, 16)

$linePen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#F59E0B'), 5)
$g.DrawLine($linePen, 406, 312, 760, 312)

$titleFont = New-Object System.Drawing.Font('Segoe UI', 92, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString('RealSSA', $titleFont, $titleBrush, 400, 200)

$tagFont = New-Object System.Drawing.Font('Segoe UI', 26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F59E0B'))
$g.DrawString('NEWS  INTELLIGENCE', $tagFont, $tagBrush, 406, 330)

$subFont = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#B8B4C4'))
$g.DrawString('The Pulse of Africa & The World', $subFont, $subBrush, 406, 382)

$cover.Save((Join-Path $images 'brand-cover.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$cover.Dispose()
$coverBg.Dispose()
$faintPen.Dispose()
$coverStarBrush.Dispose()
$coverCenter.Dispose()
$coverDot.Dispose()
$linePen.Dispose()
$titleFont.Dispose()
$titleBrush.Dispose()
$tagFont.Dispose()
$tagBrush.Dispose()
$subFont.Dispose()
$subBrush.Dispose()

Write-Host 'Brand assets generated:'
Get-Item (Join-Path $public 'logo.png'), (Join-Path $images 'brand-cover.png') |
  Select-Object FullName, Length | Format-Table -AutoSize
