/* eslint-disable */
// Auto-generated from schema.json - do not edit

export interface TopologySpec {
  /**
   * Configure dry run mode and prompts for topology operations.
   */
  checks?: {
    /**
     * Enabling the Dry Run will run the transaction with the calculated changes to the topology resources in the dry run mode and pause the workflow awaiting users confirmation.
     */
    dryRun?: boolean;
    /**
     * Prompts can be configured to request user confirmation before creating, replacing, or deleting topology resources, regardless if Dry Run is enabled or not.
     * This can be configured per operation type (BeforeCreate, BeforeReplace, BeforeDelete).
     */
    prompts?: ("BeforeCreate" | "BeforeDelete" | "BeforeReplace")[];
  };
  /**
   * Define the link parameters that are meant to be inherited by the topology links referencing the template. These parameters can be overridden at the link level.
   */
  linkTemplates?: {
    /**
     * Annotations to assign to the TopoLink.
     */
    annotations?: {
      [k: string]: string;
    };
    /**
     * Breakout endpoints propertiesfor the link
     */
    breakouts?: {
      /**
       * Local breakout endpoint properties
       */
      local?: {
        /**
         * The number of breakout channels to create
         */
        channels?: number;
        /**
         * Speed of each breakout channel
         */
        speed?: "800G" | "400G" | "200G" | "100G" | "50G" | "40G" | "25G" | "10G" | "2.5G" | "1G" | "100M";
      };
      /**
       * Remote breakout endpoint properties
       */
      remote?: {
        /**
         * The number of breakout channels to create
         */
        channels?: number;
        /**
         * Speed of each breakout channel
         */
        speed?: "800G" | "400G" | "200G" | "100G" | "50G" | "40G" | "25G" | "10G" | "2.5G" | "1G" | "100M";
      };
    }[];
    /**
     * Enable or disable VLAN tagging on Interfaces created by the TopoLink.
     */
    encapType?: "Null" | "Dot1q";
    /**
     * Labels to assign to the TopoLink.
     */
    labels?: {
      [k: string]: string;
    };
    /**
     * The name of the TopoLinkTemplate.
     */
    name: string;
    /**
     * Speed of the link.
     */
    speed?: "800G" | "400G" | "200G" | "100G" | "50G" | "40G" | "25G" | "10G" | "2.5G" | "1G" | "100M";
    /**
     * Specify the type of link.
     * If type is set to edge, topology information for the remote device can be set; when doing so the Remote Node can be set as the hostname of the remote device and Remote Interface as the remote interface name in the device specific format, e.g. eth0.
     */
    type?: "Edge" | "InterSwitch" | "Loopback";
  }[];
  /**
   * Define the set of topology links to be created/replaced/deleted. A link can reference a link template to inherit its parameters.
   */
  links?: {
    /**
     * Annotations to assign to the TopoLink.
     */
    annotations?: {
      [k: string]: string;
    };
    /**
     * Enable or disable VLAN tagging on Interfaces created by the TopoLink
     */
    encapType?: "Null" | "Dot1q";
    /**
     * Define the set of physical links making up this TopoLink.
     *
     * @minItems 1
     */
    endpoints: [
      {
        /**
         * Local, or "A" endpoint of the link.
         */
        local: {
          /**
           * Normalized name of the interface/port, e.g. ethernet-1-1.
           */
          interface?: string;
          /**
           * Reference to a Interface.
           */
          interfaceResource?: string;
          /**
           * Reference to a TopoNode.
           */
          node: string;
        };
        /**
         * Remote, or "B" endpoint of the link.
         */
        remote?: {
          /**
           * Normalized name of the interface/port, e.g. ethernet-1-1.
           */
          interface?: string;
          /**
           * Reference to a Interface.
           */
          interfaceResource?: string;
          /**
           * Reference to a TopoNode.
           */
          node: string;
        };
        /**
         * Sim endpoint of the link.
         */
        sim?: {
          /**
           * The SimNode to which the interface will be mapped. This is the name of the SimNode as it is defined in the SimTopology.
           */
          simNode?: string;
          /**
           * The name of the interface to present to the SimNode to which the interface will be mapped. If not provided the interface name will be generated starting with "eth1", "eth2", ... .
           * This is the interface name as it will appear in the SimNode.
           */
          simNodeInterface?: string;
        };
        /**
         * Speed of the link.
         */
        speed?: "800G" | "400G" | "200G" | "100G" | "50G" | "40G" | "25G" | "10G" | "2.5G" | "1G" | "100M";
        /**
         * Specify the type of link.
         * If type is set to edge, topology information for the remote device can be set; when doing so the Remote Node can be set as the hostname of the remote device and Remote Interface as the remote interface name in the device specific format, e.g. eth0.
         */
        type?: "Edge" | "InterSwitch" | "Loopback";
      },
      ...{
        /**
         * Local, or "A" endpoint of the link.
         */
        local: {
          /**
           * Normalized name of the interface/port, e.g. ethernet-1-1.
           */
          interface?: string;
          /**
           * Reference to a Interface.
           */
          interfaceResource?: string;
          /**
           * Reference to a TopoNode.
           */
          node: string;
        };
        /**
         * Remote, or "B" endpoint of the link.
         */
        remote?: {
          /**
           * Normalized name of the interface/port, e.g. ethernet-1-1.
           */
          interface?: string;
          /**
           * Reference to a Interface.
           */
          interfaceResource?: string;
          /**
           * Reference to a TopoNode.
           */
          node: string;
        };
        /**
         * Sim endpoint of the link.
         */
        sim?: {
          /**
           * The SimNode to which the interface will be mapped. This is the name of the SimNode as it is defined in the SimTopology.
           */
          simNode?: string;
          /**
           * The name of the interface to present to the SimNode to which the interface will be mapped. If not provided the interface name will be generated starting with "eth1", "eth2", ... .
           * This is the interface name as it will appear in the SimNode.
           */
          simNodeInterface?: string;
        };
        /**
         * Speed of the link.
         */
        speed?: "800G" | "400G" | "200G" | "100G" | "50G" | "40G" | "25G" | "10G" | "2.5G" | "1G" | "100M";
        /**
         * Specify the type of link.
         * If type is set to edge, topology information for the remote device can be set; when doing so the Remote Node can be set as the hostname of the remote device and Remote Interface as the remote interface name in the device specific format, e.g. eth0.
         */
        type?: "Edge" | "InterSwitch" | "Loopback";
      }[]
    ];
    /**
     * Labels to assign to the TopoLink
     */
    labels?: {
      [k: string]: string;
    };
    /**
     * The name of the TopoLink
     */
    name: string;
    /**
     * Reference to a template to use for this TopoLink.
     */
    template?: string;
  }[];
  /**
   * Define the node parameters that are meant to be inherited by the topology nodes referencing the template. These parameters can be overridden at the node level.
   */
  nodeTemplates?: {
    /**
     * Annotations to assign to the TopoNode.
     */
    annotations?: {
      [k: string]: string;
    };
    /**
     * List of components within the TopoNode.
     * Used to define the type and location of linecards, fabrics (SFM), media adapter cards (MDA) and control cards (CPM).
     */
    components?: {
      /**
       * The kind of Component, e.g. lineCard.
       */
      kind: "controlCard" | "lineCard" | "fabric" | "mda" | "connector" | "xiom" | "powerShelf" | "powerModule";
      /**
       * The slot this Component resides in, unset for Components that do not have a slot or ID.
       * e.g. 1 would denote the linecard slot 1, 1/1 would denote linecard slot 1 mda slot 1.
       */
      slot?: string;
      /**
       * Denotes the type of hardware being provisioned, e.g. xcm-x20.
       */
      type: string;
    }[];
    /**
     * Labels to assign to the TopoNode.
     */
    labels?: {
      [k: string]: string;
    };
    /**
     * Reference to a ConfigMap containing a license for the TopoNode. Overrides the license set in the referenced NodeProfile, if present.
     */
    license?: string;
    /**
     * The name of the TopoNodeTemplate.
     */
    name: string;
    /**
     * Reference to a NodeProfile to use with this TopoNode.
     */
    nodeProfile?: string;
    /**
     * Platform type of this TopoNode, e.g. 7220 IXR-D3L.
     */
    platform?: string;
    /**
     * List of satellite nodes to be inherited by nodes using this template.
     */
    satelliteNodes?: {
      /**
       * Components for the satellite node.
       */
      components?: {
        /**
         * The kind of Component, e.g. lineCard.
         */
        kind: "controlCard" | "lineCard" | "fabric" | "mda" | "connector" | "xiom" | "powerShelf" | "powerModule";
        /**
         * The slot this Component resides in, unset for Components that do not have a slot or ID.
         * e.g. 1 would denote the linecard slot 1, 1/1 would denote linecard slot 1 mda slot 1.
         */
        slot?: string;
        /**
         * Denotes the type of hardware being provisioned, e.g. xcm-x20.
         */
        type: string;
      }[];
      /**
       * ID of the satellite node.
       */
      id: string;
      /**
       *  MAC Address of the satellite node.
       */
      macAddress?: string;
      /**
       * Platform of the satellite node.
       */
      platform?: string;
      /**
       * Port template to be used for the satellite node.
       */
      portTemplate?: string;
      /**
       * Satellite profile to be used for the satellite node.
       */
      satelliteProfile?: string;
      /**
       * Type of the satellite node.
       */
      type: string;
      /**
       * Uplink interfaces to be created for the satellite node.
       */
      uplinkInterfaces?: {
        /**
         * HostPort interface of the satellite uplink.
         */
        hostPort: string;
        /**
         * Satellite interface of the satellite uplink.
         */
        satellite: string;
      }[];
    }[];
  }[];
  /**
   * Define the set of topology nodes to be created/replaced/deleted. A node can reference a node template to inherit its parameters.
   */
  nodes?: {
    /**
     * Annotations to assign to the TopoNode.
     */
    annotations?: {
      [k: string]: string;
    };
    /**
     * List of components within the TopoNode.
     * Used to define the type and location of linecards, fabrics (SFM), media adapter cards (MDA) and control cards (CPM).
     */
    components?: {
      /**
       * The kind of Component, e.g. lineCard.
       */
      kind: "controlCard" | "lineCard" | "fabric" | "mda" | "connector" | "xiom" | "powerShelf" | "powerModule";
      /**
       * The slot this Component resides in, unset for Components that do not have a slot or ID.
       * e.g. 1 would denote the linecard slot 1, 1/1 would denote linecard slot 1 mda slot 1.
       */
      slot?: string;
      /**
       * Denotes the type of hardware being provisioned, e.g. xcm-x20.
       */
      type: string;
    }[];
    /**
     * Labels to assign to the TopoNode
     */
    labels?: {
      [k: string]: string;
    };
    /**
     * Reference to a ConfigMap containing a license for the TopoNode. Overrides the license set in the referenced NodeProfile, if present.
     */
    license?: string;
    /**
     * MAC address to associate with this TopoNode.
     * Typically the chassis MAC address, optionally sent by a node in DHCP requests.
     * Not required when a TopoNode is not being bootstrapped by EDA, or is simulated through CX.
     */
    macAddress?: string;
    /**
     * The name of the TopoNode
     */
    name: string;
    /**
     * Reference to a NodeProfile to use with this TopoNode.
     */
    nodeProfile?: string;
    /**
     * Options relating to NPP interactions with the node.
     */
    npp?: {
      /**
       * The mode in which this TopoNode is functioning.
       * "normal" (the default)
       *    indicates that NPP is expecting an endpoint to exist, and will accept and confirm changes only if the endpoint
       *    accepts them.
       * "maintenance"
       *    indicates that no changes will be accepted for the TopoNode, irrespective if the endpoint is up and reachable.
       *    The exception is if an upgrade is occuring, in which case changes will be accepted.
       * "null"
       * 	  indicates that changes will be accepted from CRs and no NPP will be spun up. NPP validation will not occur.
       *    This may be useful in playground mode to avoid spinning up of 1000s of NPPs.
       * "emulate"
       *    indicates that changes will be accepted at the NPP level, without pushing them to a endpoint. NPP validation
       *    still occurs.  If no IP address is present, we also run in emulate mode.
       * "monitor"
       *    indicates that state will be collectd but config will not be pushed to a endpoint. NPP validation still occurs.
       */
      mode?: "normal" | "maintenance" | "null" | "emulate" | "monitor";
    };
    /**
     * Indicates if this TopoNode has been bootstrapped or is reachable via configured credentials. Set by BootstrapServer when it completes onboarding functions for a given TopoNode.
     * Most applications ignore TopoNodes that have not been onboarded yet.
     */
    onboarded?: boolean;
    /**
     * Operating system running on this TopoNode, e.g. srl.
     */
    operatingSystem?: "srl" | "sros" | "eos" | "sonic" | "ios-xr" | "nxos";
    /**
     * Platform type of this TopoNode, e.g. 7220 IXR-D3L.
     */
    platform?: string;
    /**
     * Production address of this TopoNode - this is the address the real, production instance of this TopoNode uses.
     * If left blank, an address will be allocated from the management IP pool specified in the referenced NodeProfile.
     * If this TopoNode is not bootstrapped by EDA this field must be provided.
     */
    productionAddress?: {
      /**
       * The IPv4 production address
       */
      ipv4?: string;
      /**
       * The IPv6 production address
       */
      ipv6?: string;
    };
    /**
     * List of satellite nodes to be inherited by this TopoNode.
     */
    satelliteNodes?: {
      /**
       * Components for the satellite node.
       */
      components?: {
        /**
         * The kind of Component, e.g. lineCard.
         */
        kind: "controlCard" | "lineCard" | "fabric" | "mda" | "connector" | "xiom" | "powerShelf" | "powerModule";
        /**
         * The slot this Component resides in, unset for Components that do not have a slot or ID.
         * e.g. 1 would denote the linecard slot 1, 1/1 would denote linecard slot 1 mda slot 1.
         */
        slot?: string;
        /**
         * Denotes the type of hardware being provisioned, e.g. xcm-x20.
         */
        type: string;
      }[];
      /**
       * ID of the satellite node.
       */
      id: string;
      /**
       *  MAC Address of the satellite node.
       */
      macAddress?: string;
      /**
       * Platform of the satellite node.
       */
      platform?: string;
      /**
       * Port template to be used for the satellite node.
       */
      portTemplate?: string;
      /**
       * Satellite profile to be used for the satellite node.
       */
      satelliteProfile?: string;
      /**
       * Type of the satellite node.
       */
      type: string;
      /**
       * Uplink interfaces to be created for the satellite node.
       */
      uplinkInterfaces?: {
        /**
         * HostPort interface of the satellite uplink.
         */
        hostPort: string;
        /**
         * Satellite interface of the satellite uplink.
         */
        satellite: string;
      }[];
    }[];
    /**
     * Serial number of this TopoNode, optionally sent by a node in DHCP requests.
     * Not required when a TopoNode is not being bootstrapped by EDA, or is simulated through CX.
     */
    serialNumber?: string;
    /**
     * Deprecated: Name of the Interface resource representing the primary loopback on the TopoNode, this field will be removed in the future version.
     */
    systemInterface?: string;
    /**
     * Reference to a template to use for this TopoNode.
     */
    template?: string;
    /**
     * Sets the software version of this TopoNode, e.g. 24.7.1 (for srl), or 24.7.r1 (for sros).
     */
    version?: string;
  }[];
  /**
   * Operation to be performed on the Topology.
   * Create - creates the topology resources based on the provided specifications.
   * Replace - replaces the resources matched by name with the provided specifications.
   * ReplaceAll - first removes all existing topology resources and then creates new ones based on the provided specifications.
   * Delete - deletes the resources matched by name.
   * DeleteAll - deletes all topology resources found in the namespace.
   * Reconcile - reconciles the topology resources based on the provided specifications.
   * One of Create, Replace, ReplaceAll, Delete, DeleteAll, Reconcile.
   */
  operation?: "Create" | "Replace" | "ReplaceAll" | "Delete" | "DeleteAll" | "Reconcile";
  /**
   * http(s) location of the topology input in YAML format to deploy. Providing the remote location will discard any topology resources provided in the spec of the workflow.
   */
  remoteLocation?: string;
  /**
   * Define the satellite port templates that are meant to be inherited by the satellite nodes referencing the template. These parameters can be overridden at the satellite node level.
   */
  satellitePortTemplates?: {
    /**
     * List of connector components within the SatellitePortTemplate.
     * Used to define the type and location of connectors.
     */
    connectors?: {
      /**
       * The kind of Component, e.g. lineCard.
       */
      kind: "controlCard" | "lineCard" | "fabric" | "mda" | "connector" | "xiom" | "powerShelf" | "powerModule";
      /**
       * The slot this Component resides in, unset for Components that do not have a slot or ID.
       * e.g. 1 would denote the linecard slot 1, 1/1 would denote linecard slot 1 mda slot 1.
       */
      slot?: string;
      /**
       * Denotes the type of hardware being provisioned, e.g. xcm-x20.
       */
      type: string;
    }[];
    /**
     * The name of the SatellitePortTemplate.
     */
    name: string;
    /**
     * Uplinks for the SatellitePortTemplate.
     */
    uplinks?: {
      /**
       * Downlinks for the SatelliteUplink.
       */
      downlinks?: string[];
      /**
       * The name of the SatelliteUplink.
       */
      name: string;
    }[];
  }[];
  /**
   * Specify simulation topology configuration.
   */
  simulation?: {
    /**
     * Define the simulation node (sim node) parameters that are meant to be inherited by the simulation nodes referencing the template. These parameters can be overridden at the sim node level.
     */
    simNodeTemplates?: {
      /**
       * Annotations to assign to the SimNode.
       */
      annotations?: {
        [k: string]: string;
      };
      /**
       * The image to use for this SimNode. This is the full path to the image as it would be provided to the container runtime.
       */
      image?: string;
      /**
       * Reference to a Secret to use when pulling the image for this simNode.
       */
      imagePullSecret?: string;
      /**
       * Labels to assign to the SimNode.
       */
      labels?: {
        [k: string]: string;
      };
      /**
       * The name of the template.
       */
      name: string;
      /**
       * Type defines what is type of this SimNode.
       */
      type?: "Linux" | "TestMan" | "SrlTest";
    }[];
    /**
     * Define the sim node to be created/replaced/deleted. A sim node can reference a sim node template to inherit its parameters.
     *
     * @minItems 0
     */
    simNodes?: {
      /**
       * Annotations to assign to the SimNode.
       */
      annotations?: {
        [k: string]: string;
      };
      /**
       * The image to use for this SimNode. This is the full path to the image as it would be provided to the container runtime.
       */
      image?: string;
      /**
       * Reference to a Secret to use when pulling the image for this simNode
       */
      imagePullSecret?: string;
      /**
       * Labels to assign to the SimNode.
       */
      labels?: {
        [k: string]: string;
      };
      /**
       * The name of the SimNode. This is the name that will be used to reference the SimNode in the SimTopology.
       */
      name: string;
      /**
       * Reference to a template to use for this SimNode.
       */
      template?: string;
      /**
       * Type defines what is type of this SimNode
       */
      type?: "Linux" | "TestMan" | "SrlTest";
    }[];
    /**
     * Define the simulation topology to be created/replaced/deleted by providing the list of nodes/interfaces and their corresponding sim nodes/sim node interfaces.
     *
     * @minItems 0
     */
    topologies?: {
      /**
       * Normalized name of an interface/port. This is the normalized name of the interface in the TopoNode, for example 'ethernet-1-1'.
       * The value of "*" indicates all interfaces on the TopoNode/s.
       */
      interface: string;
      /**
       * The TopoNode on which interfaces will be mapped to a SimNode. You may use the value "*" to indicate all TopoNodes.
       */
      node: string;
      /**
       * The SimNode to which the interface will be mapped. This is the name of the SimNode as it is defined in the SimTopology.
       */
      simNode: string;
      /**
       * The name of the interface to present to the SimNode to which the interface will be mapped. If not provided the interface name will be generated starting with "eth1", "eth2",...
       * This is the interface name as it will appear in the SimNode.
       */
      simNodeInterface?: string;
    }[];
  };
}
