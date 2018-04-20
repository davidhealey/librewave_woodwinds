/*
    Copyright 2018 David Healey

    This file is part of Libre Winds.

    Libre Winds is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Libre Winds is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Libre Winds. If not, see <http://www.gnu.org/licenses/>.
*/

include("HISE-Scripting-Framework/libraries/asyncUpdater.js");
include("HISE-Scripting-Framework/libraries/instrumentDataHandler.js");
include("HISE-Scripting-Framework/libraries/uiFactory.js");

include("theme.js");
include("paintRoutines.js");
include("settingsWindowJson.js");
include("articulationEditor.js");
include("mixer.js");
include("controllerEditor.js");

Content.makeFrontInterface(676, 392);

//Loop iterators
reg i;
reg j;

const var legatoHandler = Synth.getMidiProcessor("legatoHandler"); //legato handler script
const var sustainRoundRobin = Synth.getMidiProcessor("sustainRoundRobin"); //Sustain/legato/glide round robin handler

const var samplerIds = Synth.getIdList("Sampler");
const var containerIds = Synth.getIdList("Container");
const var scriptIds = Synth.getIdList("Script Processor");
const var gainMod = Synth.getModulator("globalGainModLFO"); //Vibrato gain modulator
const var pitchMod = Synth.getModulator("globalPitchModLFO"); //Vibrato pitch modulator
const var samplers = [];
const var releaseSamplers = [];
const var rrHandlers = []; //Round robin script processors
reg articulationName = ""; //Name of current articulation, to display to user
reg instrumentName; //Name of current instrument - populated in pnlPreset or cmbPreset

//Build array of samplers
for (id in samplerIds)
{
	samplers.push(Synth.getSampler(id));
	
	if (id.indexOf("elease") != -1) //Release sampler
    {
        releaseSamplers.push(Synth.getSampler(id));   
    }
}

//Build array of round robin handler scrips
for (id in scriptIds)
{
    if (id.indexOf("RoundRobin") == -1) continue;
    rrHandlers.push(Synth.getMidiProcessor(id));
}

//*** GUI ***
//Header
Content.setPropertiesFromJSON("pnlHeader", {itemColour:Theme.HEADER, itemColour2:Theme.HEADER});
const var pnlPreset = ui.setupControl("pnlPreset", {itemColour:Theme.PRESET, itemColour2:Theme.PRESET});

pnlPreset.setTimerCallback(function(){
    
    //Do check here to see if preset has finished loading
    loadPresetSettings();
    this.stopTimer();

});

//Logo
const var pnlLogo = ui.setupControl("pnlLogo", {textColour:Theme.LOGO});
pnlLogo.setPaintRoutine(paintRoutines.logo);

//Preset menu
const var presetNames = ui.getPresetNames();
const var cmbPreset = ui.comboBoxPanel("cmbPreset", paintRoutines.comboBox, presetNames);
cmbPreset.data["fontSize"] = Theme.LABEL_FONT_SIZE;
const var btnSavePreset = ui.momentaryButtonPanel("btnSavePreset", paintRoutines.disk);

//Tabs
const var tabs = [];
tabs[0] = Content.getComponent("pnlMain");
tabs[1] = Content.getComponent("pnlSettings");

//Main tab
Content.setPropertiesFromJSON("pnlMain", {itemColour:Theme.BODY, itemColour2:Theme.BODY}); //Background panel

const var zones = [];
zones[0] = ui.setupControl("pnlArticulations", {"itemColour":Theme.ZONE, "itemColour2":Theme.ZONE});
zones[1] = ui.setupControl("pnlMixer", {"itemColour":Theme.ZONE, "itemColour2":Theme.ZONE});
zones[2] = ui.setupControl("pnlControllers", {"itemColour":Theme.ZONE, "itemColour2":Theme.ZONE});

//Zone titles
Content.setPropertiesFromJSON("lblArtTitle", {fontName:Theme.ZONE_FONT, fontSize:Theme.ZONE_FONT_SIZE});
Content.setPropertiesFromJSON("lblMixer", {fontName:Theme.ZONE_FONT, fontSize:Theme.ZONE_FONT_SIZE});
Content.setPropertiesFromJSON("lblControllers", {fontName:Theme.ZONE_FONT, fontSize:Theme.ZONE_FONT_SIZE});

//Settings tab
const var fltSettings = Content.getComponent("fltSettings");
fltSettings.setContentData(SettingsJson.settings);

//Footer buttons
const var btnSettings = ui.buttonPanel("btnSettings", paintRoutines.gear); //Settings
const var btnRR = ui.buttonPanel("btnRR", paintRoutines.roundRobin); //Round Robin
const var btnRelease = ui.buttonPanel("btnRelease", paintRoutines.release); //Release samples purge/load

//Footer stat bar/performance meter
const var pnlStats = Content.getComponent("pnlStats");
const var lblStats = Content.getComponent("lblStats");
pnlStats.startTimer(250);
pnlStats.setTimerCallback(function()
{        
    lblStats.set("text", articulationName + ", " + "CPU: " + Math.round(Engine.getCpuUsage()) + "%" + ", " + "RAM: " + Math.round(Engine.getMemoryUsage()) + "MB" + ", " + "Voices: " + Engine.getNumVoices());
});

//Includes initialisation
articulationEditor.onInitCB(); //Initialise articulation editor
mixer.onInitCB();
controllerEditor.onInitCB();

//Functions

//Get the patch name from the preset name and assign it to the instrumentName variable for use in other parts of the script
inline function setInstrumentName()
{
    local preset = Engine.getUserPresetList()[cmbPreset.getValue()-1]; //Get current preset name
    instrumentName = preset.substring(preset.lastIndexOf(": ")+2, preset.length); //Set global variable   
}

//Just a wrapper function for loading preset settings
inline function loadPresetSettings()
{
    //setInstrumentName();
    idh.loadSampleMaps(instrumentName); //Load sample maps
    idh.loadContainerGain(instrumentName); //Set the gain of articulation containers
    setRoundRobinRange(); //Set the upper and lower note range of the RR scripts with these setting
    loadLegatoSettings();
    loadVibratoSettings();
}

inline function loadLegatoSettings()
{
    local attributes = {BEND_TIME:4, MIN_BEND:5, MAX_BEND:6, FADE_TIME:7}; //Legato handler attributes
    local settings = idh.getData(instrumentName)["legatoSettings"]; //Get instrument's legato settings
    
    legatoHandler.setAttribute(attributes.BEND_TIME, settings.bendTime);
    legatoHandler.setAttribute(attributes.MIN_BEND, settings.minBend);
    legatoHandler.setAttribute(attributes.MAX_BEND, settings.maxBend);
    legatoHandler.setAttribute(attributes.FADE_TIME, settings.fadeTime);
}

inline function loadVibratoSettings()
{
    local settings = idh.getData(instrumentName)["vibratoSettings"]; //Get instrument's vibrato settings
    
    gainMod.setIntensity(settings.gain);
    pitchMod.setIntensity(settings.pitch);
}

//Set the range of the sustain/legato/glide round robin handler
inline function setRoundRobinRange()
{
    local range = idh.getArticulationRange(instrumentName, "sustain");
    
    sustainRoundRobin.setAttribute(2, range[0]);
    sustainRoundRobin.setAttribute(3, range[1]);
}
//Turn round robin on or off
inline function changeRRSettings()
{
    for (r in rrHandlers) //Each round robin handler script
    {
        r.setAttribute(0, 1-btnRR.getValue()); //Bypass button
        if (btnRR.getValue() == 1) r.setAttribute(1, 1); //Random mode
    }
}function onNoteOn()
{
    //Check here to make sure preset is loaded
	articulationEditor.onNoteCB();
	controllerEditor.onNoteCB();
}
function onNoteOff()
{
	
}
function onController()
{   
    if (Message.getControllerNumber() == 14) //Controls RR on/off
    {
        if (Message.getControllerValue() > 64 != btnRR.getValue()) //Value has changed
        {
            btnRR.setValue(Message.getControllerValue() > 64);
            btnRR.repaint();
            changeRRSettings();
        }
    }
    
	articulationEditor.onControllerCB();	
}
function onTimer()
{
	
}
function onControl(number, value)
{
	switch (number)
	{    
	    case pnlPreset:
	        //Restore the last selected preset or default to 1
	        if (typeof value == "number" && value != 0)
            {
                cmbPreset.setValue(value);
            }
            else 
	        {
	            cmbPreset.setValue(1);
	        }
	        setInstrumentName(); //Set the name of the instrument from the current preset name
	    break;
	    
	    case cmbPreset:
	        setInstrumentName();
	        Engine.loadUserPreset(Engine.getUserPresetList()[value-1]);
	        loadPresetSettings();
	        //pnlPreset.setValue(value); //Store selected preset value in persistent parent panel
	        //pnlPreset.startTimer(500); //Trigger preset panel timer to load preset settings
	    break;
	    
		case btnSavePreset:
			if (value == 1)
	        {
			    Engine.saveUserPreset(""); //Save the current user preset
	        }
		break;
		
		case btnSettings:
		    ui.showControlFromArray(tabs, value);
		break;
			
		case btnRR: //RR Mode
            changeRRSettings();
		break;
		
		case btnRelease: //Release triggers purge/load
		    for (s in releaseSamplers)
            {
	            s.setAttribute(12, 1-value);
            }
            btnRelease.repaint();
		break;
				
		default:
			articulationEditor.onControlCB(number, value);
			mixer.onControlCB(number, value);
			controllerEditor.onControlCB(number, value);
		break;
	}
}