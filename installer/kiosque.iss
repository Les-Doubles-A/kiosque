; Installeur Inno Setup de kiosque. Compilation : iscc installer\kiosque.iss
; Le setup est cree dans installer\Output\kiosque-Setup-1.0.0.exe
#define MyAppExe "Kiosque.exe"
#define MyAppName "kiosque"
#define MyAppVersion "1.0.0"
#define MyAppURL "https://github.com/Les-Doubles-A/kiosque"

[Setup]
AppId={{F29D73D9-704F-5A8B-8EA6-5A7022D9893C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Les-Doubles-A
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
OutputBaseFilename={#MyAppName}-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
SetupIconFile=..\desktop\Kiosque.ico
UninstallDisplayIcon={app}\Kiosque.exe

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\desktop\target\release\Kiosque.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\manifest.json"; DestDir: "{app}\extension"; Flags: ignoreversion
Source: "..\src\*"; DestDir: "{app}\extension\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\icons\*"; DestDir: "{app}\extension\icons"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autoprograms}\{#MyAppName} - dossier de l'extension"; Filename: "{app}\extension"

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{app}\*.old.exe"
Type: files; Name: "{app}\*.new.exe"
Type: files; Name: "{app}\*.exe.old"
Type: files; Name: "{app}\*.exe.new"
