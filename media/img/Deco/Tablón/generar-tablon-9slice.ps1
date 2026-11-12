# Monta tablon-9slice.png (la imagen que usa .pf-board) a partir de las piezas de esta carpeta.
# Uso (desde la raíz del proyecto):
#   $d = (Resolve-Path "media/img/Deco/Tablón").Path
#   & "$d/generar-tablon-9slice.ps1" -dir $d -out "$d/tablon-9slice.png" -preview "$env:TEMP/tablon-preview.png"
# Si cambian las medidas, copia los números de "slice: A B" a --tablon-img-borde (A) y --tablon-img-lado (B).
param([string]$dir, [string]$out, [string]$preview)
Add-Type -AssemblyName System.Drawing
function L($n){ $b = New-Object System.Drawing.Bitmap (Join-Path $dir "$n.png"); $b.SetResolution(96,96); $b }
$e1 = L "Esquina1"; $e2 = L "Esquina2"; $sup = L "Centro superior-interior"; $lad = L "Centro de lados"; $med = L "Medio"

# Geometría (px de las imágenes originales 3000x3000)
$Y0 = 1296; $YC = 1645; $P = 690      # arriba del dibujo, corte (mitad del 1er tablón), alto de 1 tablón
$S = 150                              # ancho de la columna lateral
$LX = 605                             # borde izquierdo del dibujo en "Centro de lados"
$EX = $LX + 622             # borde izquierdo en "Esquina2" (otro marco)
$CX0 = $LX + $S; $CW = 1200           # franja central (se estira), justo a continuación del lado
$TH = $YC - $Y0                       # alto de la franja superior
$W = $S + $CW + $S; $H = $TH + $P + $TH

function Crop($b, $x, $y, $w, $h){ $r = New-Object System.Drawing.Rectangle $x,$y,$w,$h; $c = $b.Clone($r, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $c.SetResolution(96,96); $c }
function Put($g, $img, $x, $y){ $g.DrawImage($img, (New-Object System.Drawing.Rectangle $x,$y,$img.Width,$img.Height), 0,0,$img.Width,$img.Height, [System.Drawing.GraphicsUnit]::Pixel) }
function NewG($bmp){ $g = [System.Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode='NearestNeighbor'; $g.PixelOffsetMode='Half'; $g.CompositingMode='SourceCopy'; $g }

# Franja superior
$top = New-Object System.Drawing.Bitmap $W,$TH; $top.SetResolution(96,96); $g = NewG $top
$esq = Crop $e2 $EX $Y0 $S $TH
Put $g $esq 0 0                                             # esquina arriba-izquierda
Put $g (Crop $sup $CX0 $Y0 $CW $TH) $S 0                    # borde de arriba
$esqD = $esq.Clone(); $esqD.RotateFlip('RotateNoneFlipX')
Put $g $esqD ($S+$CW) 0                                     # esquina arriba-derecha = espejo
$g.Dispose()

# Franja central (1 tablón, se repite)
$mid = New-Object System.Drawing.Bitmap $W,$P; $mid.SetResolution(96,96); $g = NewG $mid
$izq = Crop $lad $LX $YC $S $P
Put $g $izq 0 0
Put $g (Crop $med $CX0 $YC $CW $P) $S 0
$der = $izq.Clone(); $der.RotateFlip('RotateNoneFlipX')
Put $g $der ($S+$CW) 0
$g.Dispose()

# Montaje: arriba + centro + abajo (= arriba volteado)
$bot = $top.Clone(); $bot.RotateFlip('RotateNoneFlipY')
$res = New-Object System.Drawing.Bitmap $W,$H; $res.SetResolution(96,96); $g = NewG $res
Put $g $top 0 0; Put $g $mid 0 $TH; Put $g $bot 0 ($TH+$P); $g.Dispose()
$res.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

# Vista previa con 3 tablones centrales
$pv = New-Object System.Drawing.Bitmap $W,($TH*2+$P*3); $pv.SetResolution(96,96); $g = NewG $pv
$g.CompositingMode='SourceOver'; $g.Clear([System.Drawing.Color]::FromArgb(255,176,178,220))
Put $g $top 0 0; for($i=0;$i -lt 3;$i++){ Put $g $mid 0 ($TH+$i*$P) }; Put $g $bot 0 ($TH+3*$P); $g.Dispose()
$pv.Save($preview, [System.Drawing.Imaging.ImageFormat]::Png)
"OK $W x $H  slice: $TH $S"
