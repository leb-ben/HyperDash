' AI Trading Bot Launcher
' Double-click this file to start the trading bot and dashboard
' Or right-click and "Create shortcut" to put on desktop

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "start-everything.bat", 1, False
