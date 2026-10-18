param(
  [string]$DocxPath = "",
  [string]$PdfPath = ""
)

$ErrorActionPreference = "Stop"
$word = $null
$doc = $null

# Windows PowerShell 5.1 may decode a UTF-8 script without BOM using the
# system code page.  Discovering the document avoids putting a non-ASCII path
# literal in executable code and keeps the script portable across code pages.
if ([string]::IsNullOrWhiteSpace($DocxPath)) {
  $candidate = Get-ChildItem -LiteralPath $PSScriptRoot -Filter "*.docx" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($null -eq $candidate) {
    throw "No DOCX file found beside this script."
  }
  $DocxPath = $candidate.FullName
}
if ([string]::IsNullOrWhiteSpace($PdfPath)) {
  $PdfPath = [System.IO.Path]::ChangeExtension($DocxPath, ".pdf")
}

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($DocxPath, $false, $false)
  $doc.EmbedTrueTypeFonts = $true
  $doc.SaveSubsetFonts = $false
  $doc.DoNotEmbedSystemFonts = $false

  foreach ($toc in $doc.TablesOfContents) {
    $toc.Update()
  }
  $doc.Fields.Update() | Out-Null
  # Word may regenerate TOC paragraphs with direct spacing that overrides styles.
  # Keep the full two-level outline on one readable page, then refresh only pages.
  foreach ($toc in $doc.TablesOfContents) {
    $toc.Range.Font.Name = "Microsoft YaHei"
    $toc.Range.Font.NameFarEast = "Microsoft YaHei"
    $toc.Range.Font.Size = 11
    $toc.Range.Font.Color = 0
    $toc.Range.ParagraphFormat.SpaceBefore = 0
    $toc.Range.ParagraphFormat.SpaceAfter = 4
    $toc.Range.ParagraphFormat.LineSpacingRule = 0
  }
  $doc.Repaginate()
  foreach ($toc in $doc.TablesOfContents) {
    $toc.UpdatePageNumbers()
  }
  $doc.Repaginate()
  $doc.Save()

  # wdExportFormatPDF=17, wdExportOptimizeForPrint=0,
  # wdExportAllDocument=0, wdExportDocumentContent=0,
  # wdExportCreateHeadingBookmarks=1.
  $doc.ExportAsFixedFormat(
    $PdfPath,
    17,
    $false,
    0,
    0,
    0,
    0,
    0,
    $true,
    $true,
    1,
    $true,
    $true,
    $false
  )

  $pages = $doc.ComputeStatistics(2)
  Write-Output "Exported PDF: $PdfPath"
  Write-Output "Word page count: $pages"
}
finally {
  if ($doc -ne $null) {
    $doc.Close($false)
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc)
  }
  if ($word -ne $null) {
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
