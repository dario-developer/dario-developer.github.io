# Monta las TIRAS del tablón (las que usa .pf-board) a partir de las piezas de "piezas/".
# Todas las piezas están dibujadas en el MISMO lienzo de 3000x3000 y en la misma posición,
# así que se recortan siempre por las mismas coordenadas.
#
#   tiras/borde-N.png  = franja de ARRIBA  (extremo izquierdo | borde-superior | extremo derecho)  1500 x 349
#                        (la de abajo es esta misma volteada; la voltea el CSS)
#   tiras/centro-N.png = 1 TABLÓN central  (lado izquierdo | medio | lado derecho)                  1500 x 690
#
# CÓMO SE COMBINAN (para que no se note el "puzle"):
#   · Cada pieza vale para los DOS lados: una esquina/lado izquierdo, en espejo, sirve de derecho
#     (y al revés). Así de 3 lados salen 3 izquierdos + 3 derechos.
#   · Las piezas casi iguales (el trazo negro coincide en más de un 80%) cuentan como UNA sola.
#   · Solo se generan tiras cuyos dos extremos son DISTINTOS (el derecho no es el espejo del
#     izquierdo), para que el tablón no salga simétrico.
#   · Antes de recortar los lados, se corrige su borde exterior en los cortes de arriba y abajo
#     para que coincida con el de lado-1: así, al apilar tablones de variantes distintas, el
#     borde no da escalones.
#
# Uso (desde la raíz del proyecto, en Windows PowerShell):
#   & "media/img/Deco/Tablon/generar-tablon.ps1"
# Al terminar dice cuántos bordes y centros ha hecho: pon tantas variables --tablon-img-borde-N /
# --tablon-img-centro-N en Css/styles.css (el resto en none).
# Para más variedad: dibuja esquina-izquierda-4 / esquina-derecha-4 / lado-4 en el mismo lienzo
# y vuelve a ejecutarlo.
# (Las piezas de "piezas/otra-escala" están dibujadas a otra escala y con otro color:
#  para esas está generar-tablon-otra-escala.ps1.)
param([string]$preview = "")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$dir    = $PSScriptRoot
$piezas = Join-Path $dir "piezas"
$tiras  = Join-Path $dir "tiras"
New-Item -ItemType Directory -Force $tiras | Out-Null

# Geometría (px del lienzo 3000x3000)
$Y0 = 1296; $YC = 1645; $P = 690      # arriba del dibujo, corte (mitad del 1er tablón), alto de 1 tablón
$S  = 150                             # ancho de la columna lateral
$LX = 605                             # borde izquierdo del dibujo en los LADOS
$EX = 1227                            # borde izquierdo del dibujo en las ESQUINAS IZQUIERDAS
$RX = 1781 - $S                       # inicio del recorte en las ESQUINAS DERECHAS (su dibujo acaba en x=1780)
$CX0 = $LX + $S; $CW = 1200           # franja central (se estira), justo a continuación del lado
$TH = $YC - $Y0                       # alto de la franja de arriba
$W = $S + $CW + $S
$SUAVIZADO = 120                      # filas que se usan para corregir el borde de los lados (cerca de cada corte)
$E_MAX = 440                          # lo más que se mete una esquina/lado en la franja del medio (px)
$PARECIDO  = 0.2                      # por debajo de esta diferencia de trazo (0 a 1), dos piezas son "la misma"

function L($nombre){ $b = New-Object System.Drawing.Bitmap (Join-Path $piezas "$nombre.png"); $b.SetResolution(96,96); $b }
function Crop($b, $x, $y, $w, $h){ $r = New-Object System.Drawing.Rectangle $x,$y,$w,$h; $c = $b.Clone($r, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $c.SetResolution(96,96); $c }
function Espejo($b){ $c = $b.Clone(); $c.RotateFlip('RotateNoneFlipX'); $c }
function Put($g, $img, $x, $y){ $g.DrawImage($img, (New-Object System.Drawing.Rectangle $x,$y,$img.Width,$img.Height), 0,0,$img.Width,$img.Height, [System.Drawing.GraphicsUnit]::Pixel) }
function NewG($bmp){ $g = [System.Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode='NearestNeighbor'; $g.PixelOffsetMode='Half'; $g.CompositingMode='SourceCopy'; $g }
function Existe($nombre){ Test-Path (Join-Path $piezas "$nombre.png") }

# Píxeles de un bitmap en un array (para comparar y corregir rápido)
function Bytes($b){
    $r = New-Object System.Drawing.Rectangle 0,0,$b.Width,$b.Height
    $d = $b.LockBits($r, 'ReadOnly', 'Format32bppArgb')
    $a = New-Object byte[] ($d.Stride * $b.Height)
    [Runtime.InteropServices.Marshal]::Copy($d.Scan0, $a, 0, $a.Length); $b.UnlockBits($d)
    @{ px = $a; stride = $d.Stride; w = $b.Width; h = $b.Height }
}
function DesdeBytes($o){
    $b = New-Object System.Drawing.Bitmap $o.w, $o.h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $b.SetResolution(96,96)
    $r = New-Object System.Drawing.Rectangle 0,0,$o.w,$o.h
    $d = $b.LockBits($r, 'WriteOnly', 'Format32bppArgb')
    [Runtime.InteropServices.Marshal]::Copy($o.px, 0, $d.Scan0, $o.px.Length); $b.UnlockBits($d); $b
}
# Diferencia entre dos piezas del mismo tamaño, mirando SOLO el trazo negro (la madera es igual en
# todas): 0 = mismo trazo · 1 = nada en común. Es 1 - (trazo en común / trazo de las dos juntas).
function Diferencia($a, $b){
    $A = Bytes $a; $B = Bytes $b; $comun = 0; $union = 0
    for ($y = 0; $y -lt $A.h; $y += 2) { for ($x = 0; $x -lt $A.w; $x++) {
        $i = $y * $A.stride + $x * 4
        $na = $A.px[$i+3] -gt 128 -and $A.px[$i+2] -lt 80
        $nb = $B.px[$i+3] -gt 128 -and $B.px[$i+2] -lt 80
        if ($na -or $nb) { $union++; if ($na -and $nb) { $comun++ } } } }
    if ($union -eq 0) { return 0 }
    1 - $comun / $union
}
# Quita las piezas repetidas (casi iguales) de una lista de @{ nombre; bmp }
function Unicas($lista){
    $u = @()
    foreach ($p in $lista) {
        $igual = $false
        foreach ($q in $u) { if ((Diferencia $p.bmp $q.bmp) -lt $PARECIDO) { $igual = $true; break } }
        if (-not $igual) { $u += $p }
    }
    ,$u
}
# Primer píxel opaco (borde exterior) de una fila
function BordeFila($o, $y){ for ($x = 0; $x -lt $o.w; $x++) { if ($o.px[$y * $o.stride + $x * 4 + 3] -gt 128) { return $x } }; 0 }
# Corrige el borde exterior de un lado recortado (150 x P) para que en la primera y la última fila
# quede en la misma x que en la referencia, desplazando poco a poco las filas cercanas al corte.
function IgualarBorde($bmp, $refArriba, $refAbajo){
    $o = Bytes $bmp; $n = New-Object byte[] $o.px.Length; [Array]::Copy($o.px, $n, $o.px.Length)
    $dArriba = (BordeFila $o 0) - $refArriba; $dAbajo = (BordeFila $o ($o.h - 1)) - $refAbajo
    for ($y = 0; $y -lt $o.h; $y++) {
        $s = 0.0
        if ($y -lt $SUAVIZADO) { $s += $dArriba * (1 - $y / $SUAVIZADO) }
        if ($o.h - 1 - $y -lt $SUAVIZADO) { $s += $dAbajo * (1 - ($o.h - 1 - $y) / $SUAVIZADO) }
        $s = [int][math]::Round($s)
        if ($s -eq 0) { continue }
        for ($x = 0; $x -lt $o.w; $x++) {
            $sx = [math]::Min($o.w - 1, [math]::Max(0, $x + $s))
            $di = $y * $o.stride + $x * 4; $si = $y * $o.stride + $sx * 4
            $n[$di] = $o.px[$si]; $n[$di+1] = $o.px[$si+1]; $n[$di+2] = $o.px[$si+2]; $n[$di+3] = $o.px[$si+3]
        }
    }
    if ($dArriba -ne 0 -or $dAbajo -ne 0) { "   (borde corregido: arriba $dArriba px, abajo $dAbajo px)" | Write-Host }
    $o.px = $n; DesdeBytes $o
}

# ---------- Extremos de la franja de ARRIBA (esquinas) ----------
# Igual que los lados: las esquinas siguen dibujando el borde de arriba mucho más allá de sus
# 150 px, así que se coge un trozo más ancho (150 + E) y se pasa a "borde-superior" justo donde
# la línea de arriba de las dos piezas está a la misma altura (sin escalón).
$supO = Bytes (L "borde-superior")
function LineaArriba($o, $x){                    # trazo negro de arriba en la columna x: @(fila de arriba, fila de abajo)
    $ini = -1
    for ($y = $Y0 - 20; $y -lt $Y0 + 120; $y++) {
        $i = $y * $o.stride + $x * 4; $negro = $o.px[$i+3] -gt 128 -and $o.px[$i+2] -lt 80
        if ($negro -and $ini -lt 0) { $ini = $y }
        elseif (-not $negro -and $ini -ge 0) { return @($ini, ($y - 1)) }
    }
    if ($ini -ge 0) { return @($ini, ($Y0 + 119)) }; $null
}
# Prueba cortes y se queda con el que mejor casa (el trazo empieza Y acaba a la misma altura en
# las dos piezas: no basta con que empiece igual, si uno es más grueso también se nota el escalón).
# $colFuente: columna de la esquina donde se corta (según E); $colSup: columna de borde-superior.
# Desfase vertical de una esquina respecto a borde-superior: cuánto más ALTA está su línea de arriba
# (mediana en la zona donde las dos dibujan el borde). Se recorta la esquina desplazada esa cantidad.
function DesfaseVertical($o){
    $d = @()
    for ($x = 900; $x -le 1550; $x += 10) {
        $a = LineaArriba $o $x; $b = LineaArriba $supO $x
        if ($null -ne $a -and $null -ne $b) { $d += ($b[0] - $a[0]) }
    }
    if (-not $d.Count) { return 0 }
    $d = $d | Sort-Object; [int]$d[[int]($d.Count / 2)]
}
function MejorCorteEsquina($o, $colFuente, $colSup, $dy){
    $mejor = $null
    for ($E = 10; $E -le $E_MAX; $E += 2) {
        $a = LineaArriba $o (& $colFuente $E); $b = LineaArriba $supO (& $colSup $E)
        if ($null -eq $a -or $null -eq $b) { continue }
        $coste = [math]::Abs($a[0] + $dy - $b[0]) + [math]::Abs($a[1] + $dy - $b[1])
        if ($null -eq $mejor -or $coste -lt $mejor[0]) { $mejor = @($coste, $E) }
    }
    if ($null -eq $mejor) { return ,@(10, 999) }
    ,@($mejor[1], $mejor[0])                     # @(corte, diferencia de trazo en px)
}
# Cada candidato guarda cómo recortarse a cualquier ancho (trozoDe) y qué columna de su imagen
# queda en el corte si se mete "a" px en el medio (colDe). Así se puede probar a juntarlo con
# borde-superior o DIRECTAMENTE con la esquina del otro lado (las esquinas ya dibujan el borde
# de arriba casi entero), y quedarse con lo que mejor case.
$izqs = @(); $ders = @()
$colSupI = { param($E) $CX0 + $E }               # a la izquierda se junta con el principio de borde-superior
$colSupD = { param($E) $CX0 + $CW - $E }         # a la derecha, con el final
foreach ($n in 1..9) {
    if (Existe "esquina-izquierda-$n") {
        $b = L "esquina-izquierda-$n"; $o = Bytes $b; $dy = DesfaseVertical $o; $yy = $Y0 - $dy
        $colN = { param($a) $EX + $S + $a }.GetNewClosure()
        $trozoN = { param($w) Crop $b $EX $yy $w $TH }.GetNewClosure()
        $trozoE = { param($w) Espejo (Crop $b $EX $yy $w $TH) }.GetNewClosure()
        $rI = MejorCorteEsquina $o $colN $colSupI $dy; $rD = MejorCorteEsquina $o $colN $colSupD $dy
        if ($dy) { "   esquina-izquierda-${n}: línea de arriba desplazada $dy px (se compensa)" }
        $izqs += @{ nombre = "esquina-izquierda-$n";          o = $o; dy = $dy; colDe = $colN; trozoDe = $trozoN; e = $rI[0]; coste = $rI[1]; bmp = (& $trozoN $S) }
        $ders += @{ nombre = "esquina-izquierda-$n (espejo)"; o = $o; dy = $dy; colDe = $colN; trozoDe = $trozoE; e = $rD[0]; coste = $rD[1]; bmp = (& $trozoE $S) } }
    if (Existe "esquina-derecha-$n") {
        $b = L "esquina-derecha-$n"; $o = Bytes $b; $dy = DesfaseVertical $o; $yy = $Y0 - $dy
        $colN = { param($a) $RX - $a }.GetNewClosure()
        $trozoN = { param($w) Crop $b ($RX + $S - $w) $yy $w $TH }.GetNewClosure()
        $trozoE = { param($w) Espejo (Crop $b ($RX + $S - $w) $yy $w $TH) }.GetNewClosure()
        $rD = MejorCorteEsquina $o $colN $colSupD $dy; $rI = MejorCorteEsquina $o $colN $colSupI $dy
        if ($dy) { "   esquina-derecha-${n}: línea de arriba desplazada $dy px (se compensa)" }
        $ders += @{ nombre = "esquina-derecha-$n";            o = $o; dy = $dy; colDe = $colN; trozoDe = $trozoN; e = $rD[0]; coste = $rD[1]; bmp = (& $trozoN $S) }
        $izqs += @{ nombre = "esquina-derecha-$n (espejo)";   o = $o; dy = $dy; colDe = $colN; trozoDe = $trozoE; e = $rI[0]; coste = $rI[1]; bmp = (& $trozoE $S) } }
}
$izqs = Unicas $izqs; $ders = Unicas $ders
"Esquinas distintas: $($izqs.Count) izquierdas, $($ders.Count) derechas"

# Mejor unión DIRECTA entre una esquina izquierda y una derecha (sin borde-superior en medio):
# la izquierda ocupa 150 + a px, la derecha el resto (150 + CW - a).
function MejorUnionDirecta($i, $d){
    $mejor = $null
    for ($a = 40; $a -le $CW - 40; $a += 2) {
        $l = LineaArriba $i.o (& $i.colDe $a); $r = LineaArriba $d.o (& $d.colDe ($CW - $a))
        if ($null -eq $l -or $null -eq $r) { continue }
        $coste = [math]::Abs($l[0] + $i.dy - $r[0] - $d.dy) + [math]::Abs($l[1] + $i.dy - $r[1] - $d.dy)
        if ($null -eq $mejor -or $coste -lt $mejor[0]) { $mejor = @($coste, $a) }
    }
    $mejor
}

# ---------- Extremos de los tablones CENTRALES (lados) ----------
# Las piezas "lado" son casi un tablón entero (su dibujo sigue hacia el medio y puede tener
# grietas que pasan de los 150 px del lado). Así que de cada lado se coge un trozo MÁS ANCHO
# (150 + E px) y se pasa al "medio" justo donde la junta entre tablones de las dos piezas está
# a la misma altura (así no hay escalón). E se busca por separado para cuando el lado va a la
# IZQUIERDA y para cuando va a la DERECHA (en espejo), porque se junta con zonas distintas del medio.
$E_MIN = 130                                      # mínimo: que entren las grietas del borde (lado-3 llega a ~80 px)
function JuntaEn($o, $x){                        # trazo de la junta en la columna x: @(fila de arriba, fila de abajo)
    $ini = -1
    for ($y = $YC + 150; $y -lt $YC + 500; $y++) {
        $i = $y * $o.stride + $x * 4; $negro = $o.px[$i+3] -gt 128 -and $o.px[$i+2] -lt 80
        if ($negro -and $ini -lt 0) { $ini = $y }
        elseif (-not $negro -and $ini -ge 0) { return @($ini, ($y - 1)) }
    }
    $null
}
$medO = Bytes (L "medio")
function MejorCorte($ladoO, $derecho){
    $mejor = $null
    for ($E = $E_MIN; $E -le $E_MAX; $E += 2) {
        $jl = JuntaEn $ladoO ($CX0 + $E)
        $jm = JuntaEn $medO $(if ($derecho) { $CX0 + $CW - $E } else { $CX0 + $E })
        if ($null -eq $jl -or $null -eq $jm) { continue }
        $coste = [math]::Abs($jl[0] - $jm[0]) + [math]::Abs($jl[1] - $jm[1])
        if ($null -eq $mejor -or $coste -lt $mejor[0]) { $mejor = @($coste, $E) }
    }
    if ($null -eq $mejor) { return $E_MIN }; $mejor[1]
}

$ref = $null; $ladosI = @(); $ladosD = @()
foreach ($n in 1..9) {
    if (-not (Existe "lado-$n")) { continue }
    $lb = L "lado-$n"; $lo = Bytes $lb
    $eI = MejorCorte $lo $false; $eD = MejorCorte $lo $true
    $cI = Crop $lb $LX $YC ($S + $eI) $P          # trozo para usarlo a la IZQUIERDA
    $cD = Crop $lb $LX $YC ($S + $eD) $P          # trozo para usarlo a la DERECHA (luego en espejo)
    if (-not $ref) { $o = Bytes $cI; $ref = @((BordeFila $o 0), (BordeFila $o ($o.h - 1))) }
    else { "lado-$n" | Write-Host; $cI = IgualarBorde $cI $ref[0] $ref[1]; $cD = IgualarBorde $cD $ref[0] $ref[1] }
    "lado-${n}: pasa al medio a $eI px (izquierda) / $eD px (derecha)"
    $muestra = Crop $cI 0 0 $S $P                 # para comparar piezas: solo la columna del lado
    $ladosI += @{ nombre = "lado-$n";          bmp = $muestra;          trozo = $cI;          e = $eI }
    $ladosD += @{ nombre = "lado-$n (espejo)"; bmp = (Espejo $muestra); trozo = (Espejo $cD); e = $eD }
}
$ladosI = Unicas $ladosI; $ladosD = Unicas $ladosD
"Lados distintos: $($ladosI.Count)"

# ¿El extremo derecho es el espejo del izquierdo? (entonces la tira saldría simétrica)
function Simetrica($izq, $der){ (Diferencia (Espejo $izq.bmp) $der.bmp) -lt $PARECIDO }

# ---------- Montaje ----------
Get-ChildItem $tiras -Filter "borde-*.png"  | Remove-Item
Get-ChildItem $tiras -Filter "centro-*.png" | Remove-Item
$sup = L "borde-superior"; $med = L "medio"

# ¿Hay alguna combinación con extremos distintos? Si no (una sola pieza), se aceptan las simétricas.
function HayAsimetrica($I, $D){ foreach ($i in $I) { foreach ($d in $D) { if (-not (Simetrica $i $d)) { return $true } } }; $false }
$asimB = HayAsimetrica $izqs $ders
$asimC = HayAsimetrica $ladosI $ladosD

$nb = 0
foreach ($i in $izqs) { foreach ($d in $ders) {
    if ($asimB -and (Simetrica $i $d)) { continue }
    $nb++
    $top = New-Object System.Drawing.Bitmap $W,$TH; $top.SetResolution(96,96); $g = NewG $top
    $costeSup = [math]::Max($i.coste, $d.coste)                          # el peor de sus dos cortes
    $directa = MejorUnionDirecta $i $d
    if ($i.e + $d.e -le $CW - 40 -and ($null -eq $directa -or $costeSup -le $directa[0])) {
        # | esquina izq. (150 + Ei) | borde-superior (lo que queda) | esquina der. (150 + Ed) |
        Put $g (Crop $sup ($CX0 + $i.e) $Y0 ($CW - $i.e - $d.e) $TH) ($S + $i.e) 0
        Put $g (& $i.trozoDe ($S + $i.e)) 0 0
        $td = & $d.trozoDe ($S + $d.e); Put $g $td ($W - $td.Width) 0
        $como = "con borde-superior (cortes a $($i.e) / $($d.e) px, diferencia $costeSup px)"
    } else {
        # | esquina izq. (150 + a) | esquina der. (el resto) |   (sin borde-superior)
        $a = $directa[1]
        Put $g (& $i.trozoDe ($S + $a)) 0 0
        $td = & $d.trozoDe ($W - $S - $a); Put $g $td ($S + $a) 0
        $como = "unión directa a $a px (diferencia $($directa[0]) px)"
    }
    $g.Dispose()
    $top.Save((Join-Path $tiras "borde-$nb.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    "borde-$nb.png  = $($i.nombre) + $($d.nombre)  -> $como"
} }

$nc = 0
foreach ($i in $ladosI) { foreach ($d in $ladosD) {
    if ($asimC -and (Simetrica $i $d)) { continue }
    $nc++
    # | lado izq. (150 + Ei) | medio (lo que queda) | lado der. en espejo (150 + Ed) |
    $mid = New-Object System.Drawing.Bitmap $W,$P; $mid.SetResolution(96,96); $g = NewG $mid
    $anchoMedio = $CW - $i.e - $d.e
    Put $g (Crop $med ($CX0 + $i.e) $YC $anchoMedio $P) ($S + $i.e) 0
    Put $g $i.trozo 0 0
    Put $g $d.trozo ($W - $d.trozo.Width) 0
    $g.Dispose()
    $mid.Save((Join-Path $tiras "centro-$nc.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    "centro-$nc.png = $($i.nombre) + $($d.nombre)"
} }

if (-not $asimB) { "AVISO: todas las esquinas son iguales (o espejo): el borde sale simetrico" }
if (-not $asimC) { "AVISO: todos los lados son iguales (o espejo): el centro sale simetrico" }

# Vista previa opcional: un tablón por cada centro (con bordes alternos)
if ($preview -and $nb -gt 0 -and $nc -gt 0) {
    $col = [math]::Min($nc, 6)
    $pv = New-Object System.Drawing.Bitmap ($W * $col + 40 * ($col - 1)), ($TH * 2 + $P * 3); $pv.SetResolution(96,96)
    $g = [System.Drawing.Graphics]::FromImage($pv); $g.Clear([System.Drawing.Color]::FromArgb(255,176,178,220))
    for ($k = 0; $k -lt $col; $k++) {
        $x = $k * ($W + 40)
        $t = [System.Drawing.Image]::FromFile((Join-Path $tiras ("borde-" + (($k % $nb) + 1) + ".png")))
        $b = [System.Drawing.Image]::FromFile((Join-Path $tiras ("borde-" + ((($k + 1) % $nb) + 1) + ".png"))); $b2 = $b.Clone(); $b2.RotateFlip('RotateNoneFlipY')
        $g.DrawImage($t, $x, 0)
        for ($j = 0; $j -lt 3; $j++) { $c = [System.Drawing.Image]::FromFile((Join-Path $tiras ("centro-" + ((($k + $j) % $nc) + 1) + ".png"))); $g.DrawImage($c, $x, $TH + $j * $P); $c.Dispose() }
        $g.DrawImage($b2, $x, $TH + 3 * $P)
        $t.Dispose(); $b.Dispose(); $b2.Dispose()
    }
    $g.Dispose(); $pv.Save($preview, [System.Drawing.Imaging.ImageFormat]::Png); "vista previa: $preview"
}
"`nHechos: $nb bordes y $nc centros  ->  en Css/styles.css: --tablon-img-borde-1..$nb y --tablon-img-centro-1..$nc"
"slice: $TH $S $P   (--tablon-img-borde / --tablon-img-lado / --tablon-img-tablon)"
