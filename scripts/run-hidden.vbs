' Runs any command with NO console window, for scheduled tasks (Suwanee Gamers).
' Usage: wscript.exe run-hidden.vbs <program> [args...]
' wscript.exe allocates no console, and window style 0 keeps the child hidden,
' so nothing flashes on screen (powershell -WindowStyle Hidden still flashes).
' Waits for the child and returns its exit code, so Task Scheduler sees the result.
Dim args, cmd, i, a
Set args = WScript.Arguments
If args.Count = 0 Then WScript.Quit 1
cmd = ""
For i = 0 To args.Count - 1
  a = args(i)
  If a = "" Or InStr(a, " ") > 0 Then a = """" & a & """"
  cmd = cmd & a & " "
Next
WScript.Quit CreateObject("WScript.Shell").Run(Trim(cmd), 0, True)
