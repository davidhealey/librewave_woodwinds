/*
    Copyright 2018, 2019 David Healey

    This file is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

namespace PresetHandler
{
    inline function onInitCB()
    {
        //legato script
        const var legato = Synth.getMidiProcessor("legato");
        
        //Vibrato modulators
        const var vibratoPitch = Synth.getModulator("vibratoPitch");
        const var vibratoGain = Synth.getModulator("vibratoGain");
        const var vibratoTimbre = Synth.getModulator("vibratoTimbre");
                
        const var roundRobin = [];
        roundRobin[0] = Synth.getMidiProcessor("roundRobin"); //Sustain RR
        roundRobin[1] = Synth.getMidiProcessor("staccatoRoundRobin"); 

        //Previos/Next preset buttons
        const var btnPreset = [];
        btnPreset[0] = Content.getComponent("btnPreset0"); //Prev
        btnPreset[1] = Content.getComponent("btnPreset1"); //Next
        btnPreset[0].setControlCallback(loadAdjacentPreset);
        btnPreset[1].setControlCallback(loadAdjacentPreset);
        
        //Get samplers as child synths
        const var samplerIds = Synth.getIdList("Sampler");
        const var childSynths = {};

        for (id in samplerIds)
        {
          childSynths[id] = Synth.getChildSynth(id);
        }

        //Get array of patch names from manifest
        const var patchNames = [];
        for (k in Manifest.patches)
        {
            patchNames.push(k);
        }

        //Persistent panel for loading preset data
        const var pnlPreset = Content.getComponent("pnlPreset");
        pnlPreset.setControlCallback(pnlPresetCB);

        //Preset selection dropdown
        const var cmbPatch = Content.getComponent("cmbPatch");
        cmbPatch.set("items", patchNames.join("\n"));
        cmbPatch.setControlCallback(cmbPatchCB);
    }

    //UI Callbacks
    inline function pnlPresetCB(control, value)
    {
        if (cmbPatch.getValue() < 1) cmbPatch.setValue(1); //Default
    }

    inline function loadAdjacentPreset(control, value)
    {
        local idx = btnPreset.indexOf(control);
        idx == 0 ? Engine.loadPreviousUserPreset(false) : Engine.loadNextUserPreset(false);
        Content.getComponent("lblPreset").set("text", Engine.getCurrentUserPresetName());
    }
    
    //Load patch and settings from manifest
    inline function cmbPatchCB(control, value)
    {
        local patchName = patchNames[value-1];
        
        colourKeys(patchName);
        loadSampleMaps(patchName);
        loadLegatoSettings(patchName);
        setRoundRobinRange(patchName);
        Content.getComponent("lblPreset").set("text", Engine.getCurrentUserPresetName());
    }

    //Functions
    inline function colourKeys(patchName)
    {
        local range = Manifest.patches[patchName].range;

        for (i = 0; i < 128; i++) //Every MIDI note
        {
            if (i < range[0] || i > range[1]) //i is outside max playable range
            {
                Engine.setKeyColour(i, Colours.withAlpha(Colours.black, 0.5)); //Reset current KS colour
            }
            else
            {
                Engine.setKeyColour(i, Colours.withAlpha(Colours.white, 0.0)); //Set key colour
            }
        }
    }

    inline function loadSampleMaps(patchName)
    {
        local sampleMaps = Sampler.getSampleMapList();

        for (id in samplerIds) //Each sampler
        {
            childSynths[id].setBypassed(false); //Enable sampler
            
            if (id == "transitions") //Transitions sampler
            {
                childSynths[id].asSampler().loadSampleMap(patchName + "_staccato"); //Load staccato sample map
            }
            else if (sampleMaps.contains(patchName + "_" + id)) //Valid sample map for sampler ID
            {
                childSynths[id].asSampler().loadSampleMap(patchName + "_" + id); //Load the sample map
            }
            else //No sample map found
            {
                childSynths[id].setBypassed(true); //Bypass sampler
                childSynths[id].asSampler().loadSampleMap("empty"); //Load empty sample map for this sampler
            }
        }
    }

    inline function loadLegatoSettings(patchName)
    {
        local settings = Manifest.patches[patchName].legatoSettings; //Get instrument's settings

        if (settings)
        {
            legato.setAttribute(legato.knbBendTm, settings.bendTime);
            legato.setAttribute(legato.knbBendMin, settings.minBend);
            legato.setAttribute(legato.knbBendMax, settings.maxBend);
            legato.setAttribute(legato.knbFadeMin, settings.minFade);
            legato.setAttribute(legato.knbFadeMax, settings.maxFade);   
        }
    }
      
    //Set the range of the sustain/legato/glide round robin handler
    inline function setRoundRobinRange(patchName)
    {
        local range = Manifest.patches[patchName].range;
      
        for (i = 0; i < roundRobin.length; i++)
        {
          roundRobin[i].setAttribute(roundRobin[i].knbLowNote, range[0]);
          roundRobin[i].setAttribute(roundRobin[i].knbHighNote, range[1]);   
        }
    }
}
