' Launches the Suwanee Gamers voice watchdog with NO console window.
' wscript.exe is a GUI-subsystem host, so it allocates no conhost -> nothing flashes.
' Window style 0 = hidden, False = do not wait for the PowerShell process to exit.
CreateObject("Wscript.Shell").Run _
  "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\Users\Larry McHale\Desktop\suwaneegamers-poc\scripts\watchdog-voice-stack.ps1""", _
  0, False
