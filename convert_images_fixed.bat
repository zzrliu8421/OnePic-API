@echo off
setlocal enabledelayedexpansion

title Simple Image Converter

echo.
echo ========================================
echo          Simple Image Converter
echo ========================================
echo.

REM Check if ImageMagick is installed
magick -version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: ImageMagick is not installed or not in PATH
    echo Please download and install ImageMagick from:
    echo https://imagemagick.org/script/download.php#windows
    echo.
    pause
    exit /b 1
)

echo ImageMagick is installed, starting conversion...
echo.

REM Create output directories
if not exist "converted" mkdir "converted"
if not exist "converted\pc" mkdir "converted\pc"
if not exist "converted\pe" mkdir "converted\pe"
if not exist "converted\pc\webp" mkdir "converted\pc\webp"
if not exist "converted\pe\webp" mkdir "converted\pe\webp"
if not exist "converted\pc\thumb" mkdir "converted\pc\thumb"
if not exist "converted\pe\thumb" mkdir "converted\pe\thumb"

set /a total_converted=0
set /a total_errors=0

REM Process PC directory
echo Processing PC directory...
if exist "images\pc" (
    for %%f in ("images\pc\*.jpg" "images\pc\*.jpeg" "images\pc\*.png" "images\pc\*.webp" "images\pc\*.avif") do (
        if exist "%%f" (
            echo   Converting: %%~nxf
            
            REM Convert to WebP
            magick "%%f" -quality 85 "converted\pc\webp\%%~nf.webp" >nul 2>&1
            if !errorlevel! equ 0 (
                echo     WebP completed
                REM Generate homepage thumbnail (320x213)
                magick "%%f" -thumbnail "320x213^" -gravity center -extent 320x213 -quality 72 -strip "converted\pc\thumb\%%~nf.webp" >nul 2>&1
                set /a total_converted+=1
            ) else (
                echo     WebP failed
                set /a total_errors+=1
            )
        )
    )
) else (
    echo   PC directory does not exist, skipping
)

echo.

REM Process PE directory
echo Processing PE directory...
if exist "images\pe" (
    for %%f in ("images\pe\*.jpg" "images\pe\*.jpeg" "images\pe\*.png" "images\pe\*.webp" "images\pe\*.avif") do (
        if exist "%%f" (
            echo   Converting: %%~nxf
            
            REM Convert to WebP
            magick "%%f" -quality 85 "converted\pe\webp\%%~nf.webp" >nul 2>&1
            if !errorlevel! equ 0 (
                echo     WebP completed
                REM Generate homepage thumbnail (320x213)
                magick "%%f" -thumbnail "320x213^" -gravity center -extent 320x213 -quality 72 -strip "converted\pe\thumb\%%~nf.webp" >nul 2>&1
                set /a total_converted+=1
            ) else (
                echo     WebP failed
                set /a total_errors+=1
            )
        )
    )
) else (
    echo   PE directory does not exist, skipping
)

echo.
echo ========================================
echo Conversion completed!
echo Successfully converted: !total_converted! files
echo Failed to convert: !total_errors! files
echo Output directory: converted
echo ========================================
echo.

REM Generate simple report
echo Image Conversion Report > "converted\report.txt"
echo Generated on: %date% %time% >> "converted\report.txt"
echo ========================== >> "converted\report.txt"
echo Successfully converted: !total_converted! files >> "converted\report.txt"
echo Failed to convert: !total_errors! files >> "converted\report.txt"
echo Output directory: converted >> "converted\report.txt"

echo Report saved to: converted\report.txt
echo.

pause